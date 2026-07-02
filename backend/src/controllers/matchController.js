const Lead = require('../models/Lead');
const Property = require('../models/Property');
const locationService = require('../services/locationService');
const {
  containsRegex,
  listingTypeForTransaction,
  transactionTypeForListing,
} = require('../utils/query');

// How far apart two locations can be and still count as a match.
const DEFAULT_RADIUS_KM = 15;

function radiusKm(req) {
  const km = Number(req.query.radiusKm);
  return Number.isFinite(km) && km > 0 ? km : DEFAULT_RADIUS_KM;
}

// Resolve a coordinate pair for a lead: prefer the stored geo point, otherwise
// geocode the free-text location once and cache it back onto the lead so we never
// pay for the same geocode twice.
async function pointForLead(lead) {
  const coords = lead.requirements?.geo?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    return { type: 'Point', coordinates: coords };
  }
  const text = lead.requirements?.location;
  if (text) {
    const place = await locationService.geocodeText(text);
    if (place) {
      // Cache the resolved point so subsequent match runs skip the geocode.
      try {
        lead.requirements.geo = {
          type: 'Point',
          coordinates: [place.lng, place.lat],
          label: place.label,
          placeId: place.placeId,
        };
        await lead.save();
      } catch (err) {
        console.error('Failed to cache geocoded lead location:', err.message);
      }
      return { type: 'Point', coordinates: [place.lng, place.lat] };
    }
  }
  return null;
}

// Relevance score (0-100) so results can be ranked and the agent sees why a
// match is strong. Considers budget headroom, exact type match and proximity.
function scoreForBudget(budget, price) {
  if (budget == null || price == null) return 10; // neutral when unknown
  if (price > budget) return 0; // over budget (usually filtered out already)
  return Math.round(20 * (1 - price / budget)); // cheaper vs budget => higher
}

function scoreForDistance(distanceKm, maxKm) {
  if (distanceKm == null) return 0;
  return Math.max(0, Math.round(25 * (1 - distanceKm / maxKm)));
}

function clampScore(n) {
  return Math.max(0, Math.min(100, n));
}

// Given a lead, find the agent's available properties that fit its requirements.
exports.findMatchesForLead = async (req, res) => {
  try {
    const { leadId } = req.params;

    const lead = await Lead.findOne({ _id: leadId, agentId: req.user.id });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    const { budgetMax, propertyType, location, transactionType } = lead.requirements || {};

    // Only ever match against this agent's own available inventory, and only the
    // right side of the market: a buyer sees Sale listings, a renter sees Rent
    // listings. `price` holds the sale price for Sale and the monthly rent for
    // Rent, so the budget comparison below is apples-to-apples once segregated.
    const listingType = listingTypeForTransaction(transactionType);
    const baseQuery = { agentId: req.user.id, isAvailable: true, listingType };

    if (budgetMax != null) baseQuery.price = { $lte: budgetMax };
    if (propertyType && propertyType !== 'Any') baseQuery.propertyType = propertyType;

    const maxKm = radiusKm(req);
    const point = await pointForLead(lead);
    let matches;

    if (point) {
      // Geofenced: nearest available properties within the radius that also
      // satisfy listing/budget/type, with the real distance for scoring.
      const rows = await Property.aggregate([
        {
          $geoNear: {
            near: point,
            distanceField: 'distanceMeters',
            maxDistance: maxKm * 1000,
            spherical: true,
            query: baseQuery,
          },
        },
      ]);
      matches = rows.map((p) => {
        const distanceKm = p.distanceMeters / 1000;
        const score = clampScore(
          55 +
            scoreForBudget(budgetMax, p.price) +
            (propertyType && propertyType !== 'Any' && p.propertyType === propertyType ? 15 : 0) +
            scoreForDistance(distanceKm, maxKm)
        );
        return { ...p, distanceKm: Math.round(distanceKm * 10) / 10, matchScore: score };
      });
    } else {
      // No coordinates anywhere — fall back to a loose text match on location.
      if (location) baseQuery.location = containsRegex(location);
      const rows = await Property.find(baseQuery).lean();
      matches = rows
        .map((p) => ({
          ...p,
          matchScore: clampScore(
            55 +
              scoreForBudget(budgetMax, p.price) +
              (propertyType && propertyType !== 'Any' && p.propertyType === propertyType ? 15 : 0)
          ),
        }))
        .sort((a, b) => b.matchScore - a.matchScore);
    }

    res.status(200).json({
      message: 'Matches found!',
      geofenced: !!point,
      count: matches.length,
      matches,
    });
  } catch (error) {
    console.error('Matching error:', error);
    res.status(500).json({ error: 'Failed to run matching engine.' });
  }
};

// Given a property, find the agent's leads whose requirements it satisfies.
exports.findLeadsForProperty = async (req, res) => {
  try {
    const { propertyId } = req.params;

    const property = await Property.findOne({ _id: propertyId, agentId: req.user.id });
    if (!property) return res.status(404).json({ error: 'Property not found.' });

    // Match only leads on the correct side of the market: a Rent listing serves
    // renters, a Sale listing serves buyers.
    const wantTxn = transactionTypeForListing(property.listingType);

    // A lead matches when the property fits its budget and type.
    const matchQuery = {
      agentId: req.user.id,
      status: { $ne: 'Closed' },
      'requirements.transactionType': wantTxn,
      $and: [
        {
          $or: [
            { 'requirements.budgetMax': { $gte: property.price } },
            { 'requirements.budgetMax': { $exists: false } },
            { 'requirements.budgetMax': null },
          ],
        },
        {
          $or: [
            { 'requirements.propertyType': property.propertyType },
            { 'requirements.propertyType': 'Any' },
            { 'requirements.propertyType': { $exists: false } },
          ],
        },
      ],
    };

    const coords = property.geo?.coordinates;
    const geofenced = Array.isArray(coords) && coords.length === 2;
    const maxKm = radiusKm(req);
    let leads;

    if (geofenced) {
      // Geofenced: leads wanting an area within the radius of this property.
      matchQuery['requirements.geo'] = {
        $near: { $geometry: { type: 'Point', coordinates: coords }, $maxDistance: maxKm * 1000 },
      };
      leads = await Lead.find(matchQuery).lean();
    } else {
      leads = await Lead.find(matchQuery).lean();

      // Loose, case-insensitive text match so a lead with no coordinates isn't
      // wrongly excluded (only applied when we can't geofence).
      const propLoc = property.location.toLowerCase();
      leads = leads.filter((lead) => {
        const wanted = lead.requirements?.location;
        if (!wanted) return true;
        return propLoc.includes(wanted.toLowerCase());
      });
    }

    // Score & rank: budget headroom + exact type match. (Distance ranking is
    // already applied by $near for the geofenced case.)
    const scored = leads
      .map((lead) => {
        const budget = lead.requirements?.budgetMax;
        const type = lead.requirements?.propertyType;
        const matchScore = clampScore(
          55 +
            (budget != null ? Math.min(20, Math.round(20 * (1 - property.price / budget))) : 10) +
            (type && type !== 'Any' && type === property.propertyType ? 15 : 0)
        );
        return { ...lead, matchScore };
      });
    if (!geofenced) scored.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      message: 'Matching leads found!',
      geofenced,
      count: scored.length,
      leads: scored,
    });
  } catch (error) {
    console.error('Reverse matching error:', error);
    res.status(500).json({ error: 'Failed to run matching engine.' });
  }
};

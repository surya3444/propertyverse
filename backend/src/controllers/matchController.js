const Lead = require('../models/Lead');
const Property = require('../models/Property');
const locationService = require('../services/locationService');

// How far apart two locations can be and still count as a match.
const DEFAULT_RADIUS_KM = 15;

function radiusMeters(req) {
  const km = Number(req.query.radiusKm);
  return (Number.isFinite(km) && km > 0 ? km : DEFAULT_RADIUS_KM) * 1000;
}

// Resolve a coordinate pair for a lead: prefer the stored geo point, otherwise
// geocode the free-text location on the fly (best effort).
async function pointForLead(lead) {
  const coords = lead.requirements?.geo?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    return { type: 'Point', coordinates: coords };
  }
  const text = lead.requirements?.location;
  if (text) {
    const place = await locationService.geocodeText(text);
    if (place) return { type: 'Point', coordinates: [place.lng, place.lat] };
  }
  return null;
}

// Given a lead, find the agent's available properties that fit its requirements.
exports.findMatchesForLead = async (req, res) => {
  try {
    const { leadId } = req.params;

    const lead = await Lead.findOne({ _id: leadId, agentId: req.user.id });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    const { budgetMax, propertyType, location } = lead.requirements || {};

    // Only ever match against this agent's own available inventory.
    const matchQuery = { agentId: req.user.id, isAvailable: true };

    if (budgetMax != null) {
      matchQuery.price = { $lte: budgetMax };
    }
    if (propertyType && propertyType !== 'Any') {
      matchQuery.propertyType = propertyType;
    }

    const point = await pointForLead(lead);
    let matches;

    if (point) {
      // Geofenced: nearest available properties within the radius that also
      // satisfy budget/type. $near returns results sorted by distance.
      matchQuery.geo = {
        $near: { $geometry: point, $maxDistance: radiusMeters(req) },
      };
      matches = await Property.find(matchQuery);
    } else {
      // No coordinates anywhere — fall back to a loose text match on location.
      if (location) matchQuery.location = { $regex: new RegExp(location, 'i') };
      matches = await Property.find(matchQuery).sort({ price: -1 });
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

    // A lead matches when the property fits its budget and type.
    const matchQuery = {
      agentId: req.user.id,
      status: { $ne: 'Closed' },
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
    let leads;

    if (geofenced) {
      // Geofenced: leads wanting an area within the radius of this property.
      matchQuery['requirements.geo'] = {
        $near: { $geometry: { type: 'Point', coordinates: coords }, $maxDistance: radiusMeters(req) },
      };
      leads = await Lead.find(matchQuery);
    } else {
      leads = await Lead.find(matchQuery).sort({ createdAt: -1 });

      // Loose, case-insensitive text match so a lead with no coordinates isn't
      // wrongly excluded (only applied when we can't geofence).
      leads = leads.filter((lead) => {
        const wanted = lead.requirements?.location;
        if (!wanted) return true;
        return property.location.toLowerCase().includes(wanted.toLowerCase());
      });
    }

    res.status(200).json({
      message: 'Matching leads found!',
      geofenced,
      count: leads.length,
      leads,
    });
  } catch (error) {
    console.error('Reverse matching error:', error);
    res.status(500).json({ error: 'Failed to run matching engine.' });
  }
};

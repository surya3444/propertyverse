const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Property = require('../models/Property');
const locationService = require('../services/locationService');
const matching = require('../services/matchingService');
const { parsePagination } = require('../utils/query');

// The candidate pool we're willing to score in memory. Comfortably above any
// single agent's inventory, but a hard ceiling so one enormous account can't
// pull a whole collection into the process.
const MAX_CANDIDATES = 500;

function radiusKm(req) {
  const km = Number(req.query.radiusKm);
  return Number.isFinite(km) && km > 0 ? km : matching.DEFAULT_RADIUS_KM;
}

// `req.user.id` is a string off the JWT. Model.find() casts it to an ObjectId
// for us, but an aggregation pipeline is passed to the driver verbatim — an
// un-cast agentId inside $geoNear.query silently matches zero documents, which
// is exactly what used to happen the moment a lead's area got geocoded.
const asObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Urgent clients first when two leads fit equally well.
const URGENCY_RANK = { High: 0, Medium: 1, Low: 2 };
const urgencyOf = (lead) => URGENCY_RANK[lead.requirements?.urgency] ?? 3;

const coordsOf = (geo) =>
  Array.isArray(geo?.coordinates) && geo.coordinates.length === 2 ? geo.coordinates : null;

// Resolve a coordinate pair for a lead: prefer the stored geo point, otherwise
// geocode the free-text location once.
//
// The resolved point is cached back onto the lead, but only *after* the response
// is on its way, and via a targeted updateOne rather than a full document save.
// A GET should never make the client wait on — or fail because of — a write it
// didn't ask for.
async function pointForLead(lead) {
  const stored = coordsOf(lead.requirements?.geo);
  if (stored) return { coordinates: stored, cache: null };

  const text = lead.requirements?.location;
  if (!text) return { coordinates: null, cache: null };

  const place = await locationService.geocodeText(text);
  if (!place) return { coordinates: null, cache: null };

  const geo = {
    type: 'Point',
    coordinates: [place.lng, place.lat],
    label: place.label,
    placeId: place.placeId,
  };
  return {
    coordinates: geo.coordinates,
    cache: () =>
      Lead.updateOne(
        { _id: lead._id, agentId: lead.agentId },
        { $set: { 'requirements.geo': geo } }
      ).catch((err) => console.error('Failed to cache geocoded lead location:', err.message)),
  };
}

// Attach the engine's verdict to a candidate row.
const withScore = (row, result) => ({
  ...row,
  matchScore: result.score,
  matchQuality: result.quality,
  matchReasons: result.reasons,
  distanceKm: result.distanceKm,
});

// Rank happens across the whole scored set before slicing, so page 2 really is
// the next-best matches rather than a second arbitrary window.
function paginate(scored, req) {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  return { page, limit, total: scored.length, rows: scored.slice(skip, skip + limit) };
}

// ---------------------------------------------------------------------------
// Properties for a lead
// ---------------------------------------------------------------------------

exports.findMatchesForLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.leadId, agentId: req.user.id });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    const wants = lead.requirements || {};
    const maxKm = radiusKm(req);

    // Coarse filter in the database: this agent's available inventory, the right
    // side of the market, a compatible type, and inside the stretched budget
    // ceiling. Everything finer-grained is scored in memory, where the engine can
    // afford to be soft about it.
    const query = {
      agentId: asObjectId(req.user.id),
      isAvailable: true,
      listingType: matching.listingTypeForTransaction(wants.transactionType),
      propertyType: { $in: matching.compatibleTypesFor(wants.propertyType) },
    };
    if (wants.budgetMax != null) {
      query.price = { $lte: wants.budgetMax * matching.BUDGET_STRETCH };
    }

    const { coordinates, cache } = await pointForLead(lead);

    // With a point we geofence the geocoded listings — but we keep the ones that
    // were never geocoded too. $geoNear drops documents with no geo field, so a
    // brand-new listing was previously invisible to every geofenced lead. Those
    // fall back to scoring on their text area.
    let candidates;
    if (coordinates) {
      const [geocoded, ungeocoded] = await Promise.all([
        Property.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates },
              distanceField: 'distanceMeters',
              maxDistance: maxKm * 1000,
              spherical: true,
              query,
            },
          },
          { $limit: MAX_CANDIDATES },
        ]),
        Property.find({ ...query, geo: { $exists: false } }).limit(MAX_CANDIDATES).lean(),
      ]);
      candidates = [...geocoded, ...ungeocoded];
    } else {
      candidates = await Property.find(query).limit(MAX_CANDIDATES).lean();
    }

    // Score against the lead as the engine should see it — including a point we
    // only just geocoded, so the very first run is geofenced, not just later ones.
    const scoringLead = coordinates
      ? { ...lead.toObject(), requirements: { ...wants, geo: { type: 'Point', coordinates } } }
      : lead.toObject();

    const scored = [];
    for (const property of candidates) {
      const result = matching.scoreMatch(scoringLead, property, { maxKm });
      if (!result.disqualified) scored.push(withScore(property, result));
    }

    // Best fit first; a fresher listing breaks a tie.
    scored.sort(
      (a, b) => b.matchScore - a.matchScore || new Date(b.createdAt) - new Date(a.createdAt)
    );

    const { page, limit, total, rows } = paginate(scored, req);

    res.status(200).json({
      message: 'Matches found!',
      geofenced: Boolean(coordinates),
      radiusKm: maxKm,
      count: rows.length,
      total,
      page,
      limit,
      matches: rows,
    });

    // Response is already on the wire — the geocode cache is a side benefit.
    if (cache) cache();
  } catch (error) {
    console.error('Matching error:', error);
    res.status(500).json({ error: 'Failed to run matching engine.' });
  }
};

// ---------------------------------------------------------------------------
// Leads for a property
// ---------------------------------------------------------------------------

exports.findLeadsForProperty = async (req, res) => {
  try {
    const property = await Property.findOne({
      _id: req.params.propertyId,
      agentId: req.user.id,
    }).lean();
    if (!property) return res.status(404).json({ error: 'Property not found.' });

    const maxKm = radiusKm(req);

    // The mirror image of the query above. A lead clears the budget gate when its
    // ceiling reaches the price after the same stretch allowance — or when it
    // never stated a budget at all.
    const minBudget = property.price / matching.BUDGET_STRETCH;

    const query = {
      agentId: asObjectId(req.user.id),
      status: { $ne: 'Closed' },
      'requirements.transactionType': matching.transactionTypeForListing(property.listingType),
      $and: [
        {
          $or: [
            { 'requirements.budgetMax': { $gte: minBudget } },
            { 'requirements.budgetMax': { $exists: false } },
            { 'requirements.budgetMax': null },
          ],
        },
        {
          $or: [
            // Type compatibility is symmetric, so the same list of types that
            // could serve this property is the list of requirements it satisfies.
            { 'requirements.propertyType': { $in: matching.compatibleTypesFor(property.propertyType) } },
            { 'requirements.propertyType': 'Any' },
            { 'requirements.propertyType': { $exists: false } },
            { 'requirements.propertyType': null },
          ],
        },
      ],
    };

    const point = coordsOf(property.geo);

    let candidates;
    if (point) {
      const [geocoded, ungeocoded] = await Promise.all([
        Lead.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: point },
              distanceField: 'distanceMeters',
              maxDistance: maxKm * 1000,
              spherical: true,
              // The lead's point lives on a nested path; without `key` Mongo can't
              // pick the index when the collection has more than one geo field.
              key: 'requirements.geo',
              query,
            },
          },
          { $limit: MAX_CANDIDATES },
        ]),
        Lead.find({ ...query, 'requirements.geo': { $exists: false } }).limit(MAX_CANDIDATES).lean(),
      ]);
      candidates = [...geocoded, ...ungeocoded];
    } else {
      candidates = await Lead.find(query).limit(MAX_CANDIDATES).lean();
    }

    const scored = [];
    for (const lead of candidates) {
      const result = matching.scoreMatch(lead, property, { maxKm });
      if (!result.disqualified) scored.push(withScore(lead, result));
    }

    // Best fit first, then the client who needs to move soonest.
    scored.sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        urgencyOf(a) - urgencyOf(b) ||
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    const { page, limit, total, rows } = paginate(scored, req);

    res.status(200).json({
      message: 'Matching leads found!',
      geofenced: Boolean(point),
      radiusKm: maxKm,
      count: rows.length,
      total,
      page,
      limit,
      leads: rows,
    });
  } catch (error) {
    console.error('Reverse matching error:', error);
    res.status(500).json({ error: 'Failed to run matching engine.' });
  }
};

const Property = require('../models/Property');
const { extractPropertyFromAudio } = require('../services/geminiService');
const { findOrCreateContact } = require('../services/contactService');

// Normalise an incoming location selection ({label, placeId, lat, lng}) into the
// GeoJSON point our schema expects. Returns undefined when coordinates are absent.
function toGeoPoint(geo) {
  if (!geo || geo.lat == null || geo.lng == null) return undefined;
  return {
    type: 'Point',
    coordinates: [Number(geo.lng), Number(geo.lat)],
    label: geo.label,
    placeId: geo.placeId,
  };
}

// Listing fields the client is allowed to set (agentId comes from the token).
const EDITABLE = [
  'title', 'price', 'propertyType', 'listingType', 'monthlyRent', 'deposit',
  'maintenance', 'location', 'features', 'furnishing', 'floor', 'totalFloors',
  'facing', 'availableFrom', 'description', 'amenities', 'status',
];

function pickEditable(body) {
  const out = {};
  for (const key of EDITABLE) if (body[key] !== undefined) out[key] = body[key];
  return out;
}

// Resolve the owner: an explicit ownerId, or owner {name, phone} we find/create
// (tagging them as an Owner). Returns an ObjectId or undefined.
async function resolveOwner(agentId, body) {
  if (body.ownerId) return body.ownerId;
  const owner = body.owner;
  if (owner && (owner.phone || owner.name)) {
    const contact = await findOrCreateContact(agentId, {
      name: owner.name,
      phone: owner.phone,
      email: owner.email,
      role: 'Owner',
    });
    return contact._id;
  }
  return undefined;
}

// Keep the legacy `isAvailable` flag in sync with the richer status field.
function availabilityFrom(status, fallback) {
  if (status) return status === 'Available' || status === 'Under Offer';
  return fallback;
}

// Create a property owned by the logged-in agent.
exports.createProperty = async (req, res) => {
  try {
    const { title, propertyType, location, listingType, monthlyRent } = req.body;
    // For rentals the monthly rent stands in for the (required) price field.
    const price = req.body.price ?? (listingType === 'Rent' ? monthlyRent : undefined);
    if (!title || price == null || !propertyType || !location) {
      return res.status(400).json({
        error: 'title, a price (or monthly rent), propertyType and location are required.',
      });
    }

    const ownerId = await resolveOwner(req.user.id, req.body);
    const fields = pickEditable(req.body);

    const property = await Property.create({
      agentId: req.user.id,
      ...fields,
      price,
      ownerId,
      geo: toGeoPoint(req.body.geo),
      isAvailable: availabilityFrom(req.body.status, req.body.isAvailable ?? true),
    });

    res.status(201).json({ message: 'Property created.', property });
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ error: 'Failed to create property.' });
  }
};

// List the agent's own properties (newest first), with optional filters.
exports.listProperties = async (req, res) => {
  try {
    const { propertyType, listingType, available } = req.query;
    const query = { agentId: req.user.id };

    if (propertyType) query.propertyType = propertyType;
    if (listingType) query.listingType = listingType;
    if (available != null) query.isAvailable = available === 'true';

    const properties = await Property.find(query).sort({ createdAt: -1 });
    res.status(200).json({ count: properties.length, properties });
  } catch (error) {
    console.error('List properties error:', error);
    res.status(500).json({ error: 'Failed to fetch properties.' });
  }
};

exports.getProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, agentId: req.user.id })
      .populate('ownerId', 'name phone email roles');
    if (!property) return res.status(404).json({ error: 'Property not found.' });
    res.status(200).json({ property });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ error: 'Failed to fetch property.' });
  }
};

exports.updateProperty = async (req, res) => {
  try {
    const update = pickEditable(req.body);

    // Location selection → GeoJSON point (or clear it).
    if ('geo' in req.body) update.geo = toGeoPoint(req.body.geo) ?? null;
    // Owner selection → contact id.
    const ownerId = await resolveOwner(req.user.id, req.body);
    if (ownerId) update.ownerId = ownerId;
    // Keep the legacy availability flag in sync with status.
    if ('status' in req.body) update.isAvailable = availabilityFrom(req.body.status);
    else if ('isAvailable' in req.body) update.isAvailable = req.body.isAvailable;

    const property = await Property.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      update,
      { new: true, runValidators: true }
    ).populate('ownerId', 'name phone email roles');
    if (!property) return res.status(404).json({ error: 'Property not found.' });
    res.status(200).json({ message: 'Property updated.', property });
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Failed to update property.' });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findOneAndDelete({ _id: req.params.id, agentId: req.user.id });
    if (!property) return res.status(404).json({ error: 'Property not found.' });
    res.status(200).json({ message: 'Property deleted.' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ error: 'Failed to delete property.' });
  }
};

// Transcribe a spoken property description into draft form fields. Nothing is
// persisted — the app pre-fills the form so the agent can review, pick the exact
// location, and save via the normal create endpoint.
exports.draftPropertyFromVoice = async (req, res) => {
  try {
    const audioFile = req.file;
    if (!audioFile) {
      return res.status(400).json({ error: 'An audio file is required.' });
    }

    const draft = await extractPropertyFromAudio(audioFile.buffer, audioFile.mimetype);
    res.status(200).json({ draft });
  } catch (error) {
    console.error('Property voice draft error:', error);
    res.status(500).json({ error: 'Failed to process the voice note.' });
  }
};

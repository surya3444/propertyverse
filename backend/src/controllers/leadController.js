const Lead = require('../models/Lead');
const { extractLeadFromAudio } = require('../services/geminiService');
const locationService = require('../services/locationService');
const { findOrCreateContact } = require('../services/contactService');

// Normalise a location selection ({label, placeId, lat, lng}) into a GeoJSON
// point. Returns undefined when coordinates are absent.
function toGeoPoint(geo) {
  if (!geo || geo.lat == null || geo.lng == null) return undefined;
  return {
    type: 'Point',
    coordinates: [Number(geo.lng), Number(geo.lat)],
    label: geo.label,
    placeId: geo.placeId,
  };
}

// A buyer wants to buy; a renter is a tenant.
const roleForTxn = (txn) => (txn === 'Rent' ? 'Tenant' : 'Buyer');

// Record a lead from a voice note. The agent comes from the auth token;
// the phone number is provided by the app (manually or from call logs).
exports.createLeadFromVoice = async (req, res) => {
  try {
    const { phoneNumber, clientName } = req.body;
    const audioFile = req.file; // attached by multer middleware

    if (!audioFile || !phoneNumber) {
      return res.status(400).json({ error: 'Phone number and audio file are required.' });
    }

    // 1. Send the audio buffer to Gemini for extraction.
    const extractedData = await extractLeadFromAudio(audioFile.buffer, audioFile.mimetype);

    // 2. Best-effort geocode of the spoken location so the lead is immediately
    //    matchable. The agent can still refine to the exact area afterwards.
    let geo;
    if (extractedData.location) {
      const place = await locationService.geocodeText(extractedData.location);
      geo = toGeoPoint(place);
    }

    const transactionType = req.body.transactionType === 'Rent' ? 'Rent' : 'Buy';
    const name = clientName || extractedData.clientName || 'Unknown Client';

    // 3. Link (or create) the contact this requirement belongs to.
    const contact = await findOrCreateContact(req.user.id, {
      name,
      phone: phoneNumber,
      role: roleForTxn(transactionType),
    });

    // 4. Map the extracted data to our Lead model.
    const newLead = new Lead({
      agentId: req.user.id,
      contactId: contact._id,
      phoneNumber,
      clientName: name,
      requirements: {
        transactionType,
        budgetMax: extractedData.budgetMax,
        propertyType: extractedData.propertyType,
        location: extractedData.location,
        geo,
        urgency: extractedData.urgency,
        rawAudioTranscript: extractedData.rawTranscript,
      },
    });

    await newLead.save();

    res.status(201).json({
      message: 'Lead captured and structured successfully!',
      lead: newLead,
    });
  } catch (error) {
    console.error('Error processing voice lead:', error);
    res.status(500).json({ error: 'Failed to process the voice note.' });
  }
};

// If a requirements object carries a raw location selection, convert its geo
// into the GeoJSON point the schema expects (mutates a shallow copy).
function normaliseRequirements(requirements) {
  if (!requirements || !('geo' in requirements)) return requirements;
  return { ...requirements, geo: toGeoPoint(requirements.geo) ?? null };
}

// Create a lead manually (without a voice note).
exports.createLead = async (req, res) => {
  try {
    const { phoneNumber, clientName, requirements, status } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const contact = await findOrCreateContact(req.user.id, {
      name: clientName,
      phone: phoneNumber,
      role: roleForTxn(requirements?.transactionType),
    });

    const lead = await Lead.create({
      agentId: req.user.id,
      contactId: contact._id,
      phoneNumber,
      clientName,
      requirements: normaliseRequirements(requirements),
      status,
    });

    res.status(201).json({ message: 'Lead created.', lead });
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead.' });
  }
};

exports.listLeads = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { agentId: req.user.id };
    if (status) query.status = status;

    const leads = await Lead.find(query).sort({ createdAt: -1 });
    res.status(200).json({ count: leads.length, leads });
  } catch (error) {
    console.error('List leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads.' });
  }
};

exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, agentId: req.user.id })
      .populate('contactId', 'name phone');
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.status(200).json({ lead });
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead.' });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.requirements) update.requirements = normaliseRequirements(update.requirements);

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      update,
      { new: true, runValidators: true }
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.status(200).json({ message: 'Lead updated.', lead });
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead.' });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, agentId: req.user.id });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    res.status(200).json({ message: 'Lead deleted.' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead.' });
  }
};

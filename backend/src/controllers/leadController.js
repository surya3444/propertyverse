const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Property = require('../models/Property');
const { extractLeadFromAudio, AiExtractionError } = require('../services/geminiService');
const locationService = require('../services/locationService');
const { findOrCreateContact } = require('../services/contactService');
const { getFieldDefs, sanitizeCustomValues } = require('../services/customFieldService');
const audit = require('../services/auditService');
const { parsePagination } = require('../utils/query');
const { pickFields, resolveOwnedRef, InvalidReferenceError } = require('../utils/ownership');

// Lead fields a client may set. `agentId`, `source` and `formId` are server-owned:
// spreading req.body here would let a caller reassign the lead to another agent.
const EDITABLE = [
  'clientName', 'phoneNumber', 'requirements', 'status', 'reviewed',
  'customFields', 'contactId', 'closedPropertyId',
];

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

    // 1. Send the audio buffer to Gemini for extraction, feeding in the agent's
    //    custom lead fields so the voice note can populate them too.
    const customFieldDefs = await getFieldDefs(req.user.id, 'lead');
    const extractedData = await extractLeadFromAudio(
      audioFile.buffer, audioFile.mimetype, customFieldDefs
    );

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

    // 4. Map the extracted data to our Lead model. Voice leads are AI-extracted,
    //    so they start unreviewed until the agent confirms the requirements.
    const newLead = new Lead({
      agentId: req.user.id,
      contactId: contact._id,
      phoneNumber,
      clientName: name,
      source: 'voice',
      reviewed: false,
      requirements: {
        transactionType,
        budgetMax: extractedData.budgetMax,
        propertyType: extractedData.propertyType,
        bedrooms: extractedData.bedrooms,
        location: extractedData.location,
        geo,
        urgency: extractedData.urgency,
        rawAudioTranscript: extractedData.rawTranscript,
      },
      customFields: sanitizeCustomValues(extractedData.customFields, customFieldDefs),
    });

    await newLead.save();
    await audit.record(req.user.id, 'create', 'Lead', newLead._id, { after: audit.snapshot(newLead) });

    res.status(201).json({
      message: 'Lead captured and structured successfully!',
      lead: newLead,
    });
  } catch (error) {
    // Surface a meaningful status for AI-specific failures (bad audio, quota…).
    if (error instanceof AiExtractionError) {
      return res.status(error.status).json({ error: error.message });
    }
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
      source: 'manual',
      reviewed: true,
      requirements: normaliseRequirements(requirements),
      status,
      customFields:
        req.body.customFields !== undefined
          ? sanitizeCustomValues(req.body.customFields, await getFieldDefs(req.user.id, 'lead'))
          : undefined,
    });

    await audit.record(req.user.id, 'create', 'Lead', lead._id, { after: audit.snapshot(lead) });
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

    const { page, limit, skip } = parsePagination(req.query);
    const [leads, total] = await Promise.all([
      Lead.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Lead.countDocuments(query),
    ]);

    res.status(200).json({ count: leads.length, total, page, limit, leads });
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
    const before = await Lead.findOne({ _id: req.params.id, agentId: req.user.id });
    if (!before) return res.status(404).json({ error: 'Lead not found.' });

    const update = pickFields(req.body, EDITABLE);
    // Sanitize custom values against the agent's lead schema (never trust keys).
    if (update.customFields !== undefined) {
      update.customFields = sanitizeCustomValues(
        update.customFields, await getFieldDefs(req.user.id, 'lead')
      );
    }
    // Any manual edit to the requirements counts as the agent reviewing the
    // AI-extracted lead.
    if (update.requirements) {
      update.requirements = normaliseRequirements(update.requirements);
      update.reviewed = true;
    }
    // Moving to Closed against a specific property records the deal.
    if (update.status === 'Closed' && update.closedPropertyId === undefined && req.body.propertyId) {
      update.closedPropertyId = req.body.propertyId;
    }

    // Both references must resolve inside this agent's own data. Otherwise a
    // caller could attach a foreign contact and read it back through the
    // populate in getLead.
    if (update.contactId !== undefined) {
      update.contactId = await resolveOwnedRef(Contact, update.contactId, req.user.id, 'contact');
    }
    if (update.closedPropertyId !== undefined) {
      update.closedPropertyId = await resolveOwnedRef(
        Property, update.closedPropertyId, req.user.id, 'property'
      );
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      update,
      { new: true, runValidators: true }
    );
    // Deleted between the read above and this write.
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    await audit.record(req.user.id, 'update', 'Lead', lead._id, {
      before: audit.snapshot(before),
      after: audit.snapshot(lead),
    });
    res.status(200).json({ message: 'Lead updated.', lead });
  } catch (error) {
    if (error instanceof InvalidReferenceError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead.' });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, agentId: req.user.id });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    // Clean up activities that referenced this lead's contact-only? Activities are
    // tied to contacts, not leads, so nothing to cascade here. Record the delete.
    await audit.record(req.user.id, 'delete', 'Lead', lead._id, { before: audit.snapshot(lead) });
    res.status(200).json({ message: 'Lead deleted.' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead.' });
  }
};

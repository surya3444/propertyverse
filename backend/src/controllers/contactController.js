const Contact = require('../models/Contact');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const { findOrCreateContact } = require('../services/contactService');
const { getFieldDefs, sanitizeCustomValues } = require('../services/customFieldService');
const audit = require('../services/auditService');
const { parsePagination, containsRegex } = require('../utils/query');
const { pickFields } = require('../utils/ownership');

// Contact fields a client may set. `agentId` is server-owned.
const EDITABLE = ['name', 'phone', 'email', 'notes', 'roles', 'customFields'];

// Create a contact manually (or reuse an existing one by phone).
exports.createContact = async (req, res) => {
  try {
    const { name, phone, email, notes, role } = req.body;
    if (!name && !phone) {
      return res.status(400).json({ error: 'A name or phone is required.' });
    }
    const contact = await findOrCreateContact(req.user.id, { name, phone, email, role });
    let dirty = false;
    if (notes && !contact.notes) {
      contact.notes = notes;
      dirty = true;
    }
    if (req.body.customFields !== undefined) {
      const defs = await getFieldDefs(req.user.id, 'contact');
      contact.customFields = sanitizeCustomValues(req.body.customFields, defs);
      dirty = true;
    }
    if (dirty) await contact.save();
    await audit.record(req.user.id, 'create', 'Contact', contact._id, {
      after: audit.snapshot(contact),
    });
    res.status(201).json({ message: 'Contact saved.', contact });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to save contact.' });
  }
};

// List contacts with optional role filter (?role=Owner) and search (?q=).
exports.listContacts = async (req, res) => {
  try {
    const { role, q } = req.query;
    const query = { agentId: req.user.id };
    if (role) query.roles = role;
    if (q) {
      // Escaped so a search string can never act as a regex pattern (ReDoS/injection).
      const rx = containsRegex(q);
      query.$or = [{ name: rx }, { phone: rx }];
    }
    const { page, limit, skip } = parsePagination(req.query);
    const [contacts, total] = await Promise.all([
      Contact.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      Contact.countDocuments(query),
    ]);
    res.status(200).json({ count: contacts.length, total, page, limit, contacts });
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts.' });
  }
};

// A contact plus everything linked to them: owned properties, requirements
// (leads) and their activity timeline.
exports.getContact = async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, agentId: req.user.id });
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });

    const [properties, requirements, activities] = await Promise.all([
      Property.find({ agentId: req.user.id, ownerId: contact._id }).sort({ createdAt: -1 }),
      Lead.find({ agentId: req.user.id, contactId: contact._id }).sort({ createdAt: -1 }),
      Activity.find({ agentId: req.user.id, contactId: contact._id }).sort({ scheduledAt: -1, createdAt: -1 }),
    ]);

    res.status(200).json({ contact, properties, requirements, activities });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to fetch contact.' });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const before = await Contact.findOne({ _id: req.params.id, agentId: req.user.id });
    if (!before) return res.status(404).json({ error: 'Contact not found.' });

    const update = pickFields(req.body, EDITABLE);
    // Sanitize custom values against the agent's contact schema (never trust keys).
    if (update.customFields !== undefined) {
      update.customFields = sanitizeCustomValues(
        update.customFields, await getFieldDefs(req.user.id, 'contact')
      );
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      update,
      { new: true, runValidators: true }
    );
    // Deleted between the read above and this write.
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });

    await audit.record(req.user.id, 'update', 'Contact', contact._id, {
      before: audit.snapshot(before),
      after: audit.snapshot(contact),
    });
    res.status(200).json({ message: 'Contact updated.', contact });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact.' });
  }
};

// Delete a contact. By default we refuse if the contact is still linked to
// properties, leads or activities (returns the counts so the UI can warn). Pass
// ?force=true to cascade: activities are removed, and owner/contact references on
// properties and leads are detached — never left dangling.
exports.deleteContact = async (req, res) => {
  try {
    const agentId = req.user.id;
    const contact = await Contact.findOne({ _id: req.params.id, agentId });
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });

    const [properties, leads, activities] = await Promise.all([
      Property.countDocuments({ agentId, ownerId: contact._id }),
      Lead.countDocuments({ agentId, contactId: contact._id }),
      Activity.countDocuments({ agentId, contactId: contact._id }),
    ]);

    const force = req.query.force === 'true';
    if (!force && (properties || leads || activities)) {
      return res.status(409).json({
        error: 'This contact is still linked to other records.',
        links: { properties, leads, activities },
        hint: 'Retry with ?force=true to detach these and delete the contact.',
      });
    }

    if (force) {
      await Promise.all([
        Property.updateMany({ agentId, ownerId: contact._id }, { $unset: { ownerId: '' } }),
        Lead.updateMany({ agentId, contactId: contact._id }, { $unset: { contactId: '' } }),
        Activity.deleteMany({ agentId, contactId: contact._id }),
      ]);
    }

    await Contact.deleteOne({ _id: contact._id, agentId });
    await audit.record(agentId, 'delete', 'Contact', contact._id, {
      before: audit.snapshot(contact),
    });
    res.status(200).json({ message: 'Contact deleted.' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact.' });
  }
};

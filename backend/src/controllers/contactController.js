const Contact = require('../models/Contact');
const Property = require('../models/Property');
const Lead = require('../models/Lead');
const Activity = require('../models/Activity');
const { findOrCreateContact } = require('../services/contactService');

// Create a contact manually (or reuse an existing one by phone).
exports.createContact = async (req, res) => {
  try {
    const { name, phone, email, notes, role } = req.body;
    if (!name && !phone) {
      return res.status(400).json({ error: 'A name or phone is required.' });
    }
    const contact = await findOrCreateContact(req.user.id, { name, phone, email, role });
    if (notes && !contact.notes) {
      contact.notes = notes;
      await contact.save();
    }
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
      const rx = new RegExp(q.trim(), 'i');
      query.$or = [{ name: rx }, { phone: rx }];
    }
    const contacts = await Contact.find(query).sort({ updatedAt: -1 });
    res.status(200).json({ count: contacts.length, contacts });
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
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });
    res.status(200).json({ message: 'Contact updated.', contact });
  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact.' });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({ _id: req.params.id, agentId: req.user.id });
    if (!contact) return res.status(404).json({ error: 'Contact not found.' });
    res.status(200).json({ message: 'Contact deleted.' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact.' });
  }
};

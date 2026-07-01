const Contact = require('../models/Contact');

// Find a contact by phone within an agent's book, or create one. Also fills in a
// missing name/email and adds a role (Owner/Buyer/Tenant/Seller) idempotently.
// Used when creating properties (owner) and leads (buyer/tenant) so a person is
// never duplicated.
async function findOrCreateContact(agentId, { name, phone, email, role } = {}) {
  let contact = phone ? await Contact.findOne({ agentId, phone }) : null;

  if (!contact) {
    return Contact.create({
      agentId,
      name: name || 'Unknown',
      phone,
      email,
      roles: role ? [role] : [],
    });
  }

  const set = {};
  if (name && (!contact.name || contact.name === 'Unknown')) set.name = name;
  if (email && !contact.email) set.email = email;

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (role) update.$addToSet = { roles: role };

  if (Object.keys(update).length) {
    contact = await Contact.findByIdAndUpdate(contact._id, update, { new: true });
  }
  return contact;
}

module.exports = { findOrCreateContact };

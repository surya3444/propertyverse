const Contact = require('../models/Contact');

// Find a contact by phone within an agent's book, or create one. Also fills in a
// missing name/email and adds a role (Owner/Buyer/Tenant/Seller) idempotently.
// Used when creating properties (owner) and leads (buyer/tenant) so a person is
// never duplicated.
//
// Uses an atomic upsert keyed on { agentId, phone } (backed by a unique index) so
// two concurrent requests for the same number can't create duplicate contacts.
async function findOrCreateContact(agentId, { name, phone, email, role } = {}) {
  // Without a phone we can't dedupe, so just create a fresh contact.
  if (!phone) {
    return Contact.create({
      agentId,
      name: name || 'Unknown',
      email,
      roles: role ? [role] : [],
    });
  }

  // Ensure the contact exists (atomically). $setOnInsert only applies on create.
  const upsert = {
    $setOnInsert: { agentId, phone, name: name || 'Unknown' },
  };
  if (role) upsert.$addToSet = { roles: role };

  let contact = await Contact.findOneAndUpdate({ agentId, phone }, upsert, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  // Enrich an existing record: fill a placeholder name / missing email.
  const set = {};
  if (name && (!contact.name || contact.name === 'Unknown')) set.name = name;
  if (email && !contact.email) set.email = email;
  if (Object.keys(set).length) {
    contact = await Contact.findByIdAndUpdate(contact._id, { $set: set }, { new: true });
  }

  return contact;
}

module.exports = { findOrCreateContact };

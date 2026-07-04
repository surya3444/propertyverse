const mongoose = require('mongoose');

// A person in the agent's CRM. The same contact can be an owner (linked from
// properties) and/or a buyer/tenant (linked from leads). Roles are maintained
// as those links are created.
const contactSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, default: 'Unknown' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    notes: { type: String },
    roles: {
      type: [String],
      enum: ['Owner', 'Buyer', 'Tenant', 'Seller'],
      default: [],
    },
    // Agent-defined custom field values (keyed by CustomFieldDef field key).
    // Sanitized server-side against the agent's schema.
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// One person per phone within an agent's book (used by find-or-create). Unique so
// concurrent find-or-create can't create duplicates; the partial filter keeps the
// constraint from firing on the many contacts that have no phone at all.
contactSchema.index(
  { agentId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);
// Contact list ordering (most recently touched first).
contactSchema.index({ agentId: 1, updatedAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);

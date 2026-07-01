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
  },
  { timestamps: true }
);

// One person per phone within an agent's book (used by find-or-create).
contactSchema.index({ agentId: 1, phone: 1 });

module.exports = mongoose.model('Contact', contactSchema);

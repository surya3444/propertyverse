const mongoose = require('mongoose');

// A single public submission of a Form. Stores the raw answers (so custom
// questions are never lost) plus references to the records it produced. Doubles
// as the agent-facing "responses" feed for a form.
const formResponseSchema = new mongoose.Schema(
  {
    formId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Form',
      required: true,
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    formType: { type: String, enum: ['lead', 'property'], required: true },
    // Raw answers keyed by field key (includes custom questions).
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A form's responses, newest first.
formResponseSchema.index({ formId: 1, createdAt: -1 });

module.exports = mongoose.model('FormResponse', formResponseSchema);

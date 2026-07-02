const mongoose = require('mongoose');

// A scheduled interaction: a site visit, a follow-up, a call, or a note.
// Always tied to a contact; optionally to a specific property.
const activitySchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
    },
    kind: {
      type: String,
      enum: ['Visit', 'Follow-up', 'Call', 'Note'],
      default: 'Follow-up',
    },
    scheduledAt: { type: Date },
    status: {
      type: String,
      enum: ['Scheduled', 'Done', 'Cancelled', 'Missed'],
      default: 'Scheduled',
    },
    notes: { type: String },
    outcome: { type: String },
  },
  { timestamps: true }
);

// Agenda queries: an agent's activities ordered by time.
activitySchema.index({ agentId: 1, scheduledAt: 1 });
// The overdue-sweep looks up scheduled activities whose time has passed.
activitySchema.index({ status: 1, scheduledAt: 1 });
// Contact timeline lookups.
activitySchema.index({ agentId: 1, contactId: 1 });

module.exports = mongoose.model('Activity', activitySchema);

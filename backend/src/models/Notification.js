const mongoose = require('mongoose');

// An in-app notification for an agent. Currently only 'form_response' events, but
// the shape is generic so other event types can be added later. Surfaced by the
// bell/badge in the app and the Notifications screen; also fanned out to push
// (see services/pushService.js) when Firebase is configured.
const notificationSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, default: 'form_response' },
    title: { type: String, required: true },
    body: { type: String },
    formId: { type: mongoose.Schema.Types.ObjectId, ref: 'Form' },
    responseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse' },
    // The record this notification deep-links to.
    entityType: { type: String, enum: ['Lead', 'Property'] },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Unread-first lookups and the notifications feed (newest first).
notificationSchema.index({ agentId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);

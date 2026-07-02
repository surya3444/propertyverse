const mongoose = require('mongoose');

// An append-only record of who changed what. Written on create/update/delete of
// the core entities so there is an enterprise-grade trail (and a recovery path
// for hard-deleted documents via the `before` snapshot).
const auditLogSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
    },
    entity: {
      type: String,
      enum: ['Lead', 'Property', 'Contact', 'Activity'],
      required: true,
    },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Snapshot of the document before the change (delete/update) for recovery.
    before: { type: mongoose.Schema.Types.Mixed },
    // Snapshot after the change (create/update).
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Recent activity for an agent / a specific record.
auditLogSchema.index({ agentId: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

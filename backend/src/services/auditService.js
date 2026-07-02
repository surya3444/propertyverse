const AuditLog = require('../models/AuditLog');

// Best-effort audit trail. Never throws into the request path — a failed audit
// write must not fail the user's action, so we log and move on.
async function record(agentId, action, entity, entityId, { before, after } = {}) {
  try {
    await AuditLog.create({ agentId, action, entity, entityId, before, after });
  } catch (err) {
    console.error('Audit log write failed:', err.message);
  }
}

// Convenience: normalise a Mongoose doc to a plain object for snapshots.
function snapshot(doc) {
  if (!doc) return undefined;
  return typeof doc.toObject === 'function' ? doc.toObject() : doc;
}

module.exports = { record, snapshot };

// Guards for client-supplied data on write paths.
//
// Two distinct problems live here:
//
//  1. Reference IDs. A request body may point a record at another document
//     (a property's owner, an activity's contact). Scoping the *record* by
//     agentId is not enough — the *reference* must be scoped too, or an agent
//     can attach a foreign contact and read it back through .populate().
//
//  2. Mass assignment. Spreading req.body into findOneAndUpdate lets a client
//     write any schema path, including agentId. Always pick from an allowlist.

const mongoose = require('mongoose');

// A rejected write carries a user-facing message + status.
class InvalidReferenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidReferenceError';
    this.status = 400;
  }
}

// mongoose.isValidObjectId() also accepts any 12-character string, which would
// let "aaaaaaaaaaaa" through. Require the canonical 24-char hex form.
const OBJECT_ID = /^[a-f\d]{24}$/i;

function isObjectId(value) {
  return typeof value === 'string' ? OBJECT_ID.test(value) : value instanceof mongoose.Types.ObjectId;
}

// Resolve a client-supplied reference to a document the agent actually owns.
// Returns undefined for a blank reference (the caller decides whether that's an
// error) and null when the caller explicitly clears it.
async function resolveOwnedRef(Model, id, agentId, label) {
  if (id === undefined || id === '') return undefined;
  if (id === null) return null;
  if (!isObjectId(id)) throw new InvalidReferenceError(`That ${label} reference is not valid.`);

  const doc = await Model.findOne({ _id: id, agentId }).select('_id').lean();
  if (!doc) throw new InvalidReferenceError(`That ${label} was not found.`);
  return doc._id;
}

// Copy only allowlisted keys off a request body. Keys absent from the body stay
// absent from the update (so a partial PUT doesn't unset fields).
function pickFields(body, allowed) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

module.exports = { InvalidReferenceError, isObjectId, resolveOwnedRef, pickFields };

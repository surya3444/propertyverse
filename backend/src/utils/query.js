// Small shared helpers for building safe, consistent queries.

// Escape a user/AI-supplied string so it can be used literally inside a RegExp
// without acting as a pattern (prevents regex injection / ReDoS).
function escapeRegex(input = '') {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Case-insensitive "contains" matcher built from untrusted text.
function containsRegex(input) {
  return new RegExp(escapeRegex(String(input).trim()), 'i');
}

// Parse ?page & ?limit into safe skip/limit values with sane bounds.
function parsePagination(query, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

// The buy/rent ↔ sale/rent mapping now lives with the matching engine
// (services/matchingService.js), which is the only thing that needs it.

module.exports = {
  escapeRegex,
  containsRegex,
  parsePagination,
};

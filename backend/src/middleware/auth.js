const jwt = require('jsonwebtoken');

// Pin the algorithm. Without this, jwt.verify honours whatever `alg` the token's
// own header names — the shape of every JWT algorithm-confusion attack.
const VERIFY_OPTIONS = { algorithms: ['HS256'] };

// Verify a bearer token and return its payload, or null when it doesn't check
// out. Shared with the SSE stream, which authenticates outside this middleware.
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, VERIFY_OPTIONS);
  } catch {
    return null;
  }
}

// Pull the bearer token off the Authorization header.
function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

// Verifies the Bearer token and attaches { id, email } to req.user.
function auth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication token missing.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.user = { id: payload.sub, email: payload.email };
  next();
}

module.exports = auth;
module.exports.verifyToken = verifyToken;
module.exports.bearerToken = bearerToken;

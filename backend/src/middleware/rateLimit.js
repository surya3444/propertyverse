const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Baseline limiter for the whole API — generous enough for normal app use but a
// hard ceiling against runaway clients / abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

// Tight limiter for the paid AI / voice endpoints (each call hits Gemini and
// Google Places, so these cost real money and must be throttled per user).
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  // Throttle per authenticated agent when available, else per IP (IPv6-safe).
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  message: { error: 'Too many voice uploads. Please wait a moment before trying again.' },
});

// Stricter limiter for auth endpoints to blunt credential-stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait and try again.' },
});

// Public, unauthenticated form submissions — keyed per IP to blunt spam/abuse of
// an agent's shared form link while staying generous for legitimate visitors.
const publicSubmitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please wait a moment and try again.' },
});

// Public, unauthenticated file uploads for a form. Tighter than submit because
// each request can carry several files straight to Cloudinary.
const publicUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // files come in batches; a legit submitter may retry a few times
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please wait a moment and try again.' },
});

module.exports = { apiLimiter, aiLimiter, authLimiter, publicSubmitLimiter, publicUploadLimiter };

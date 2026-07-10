// Fail fast on missing configuration.
//
// A missing JWT_SECRET used to surface as confusing 401s at request time (
// jwt.verify throws, the middleware catches it and reports "invalid token").
// Boot-time validation turns that into an obvious crash on deploy instead.

const REQUIRED = ['MONGO_URI', 'JWT_SECRET'];

// A short secret is barely better than no secret against an offline attack on a
// leaked token. HS256 keys should be at least as long as the digest.
const MIN_JWT_SECRET_LENGTH = 32;

function assertEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}.`);
  }

  if (process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters. ` +
        'Generate one with: openssl rand -base64 48'
    );
  }

  if (isProduction() && !process.env.CORS_ORIGINS) {
    throw new Error(
      'CORS_ORIGINS must be set in production (comma-separated list of allowed origins).'
    );
  }
}

const isProduction = () => process.env.NODE_ENV === 'production';

module.exports = { assertEnv, isProduction };

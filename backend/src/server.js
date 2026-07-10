require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

const { assertEnv, isProduction } = require('./config/env');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimit');
const { markOverdueActivities } = require('./controllers/activityController');
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const locationRoutes = require('./routes/locationRoutes');
const contactRoutes = require('./routes/contactRoutes');
const activityRoutes = require('./routes/activityRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const formRoutes = require('./routes/formRoutes');
const publicRoutes = require('./routes/publicRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const customFieldRoutes = require('./routes/customFieldRoutes');

// Crash on deploy rather than at the first request if config is missing.
assertEnv();

const app = express();

// Behind Render/Netlify/nginx the client IP is in X-Forwarded-For. Without this
// every request looks like it comes from the proxy and the per-IP rate limiters
// throttle all users as one. Trust exactly one hop.
app.set('trust proxy', 1);

// Secure HTTP headers.
app.use(helmet());

// CORS: an explicit allowlist. Outside production an empty list means "allow
// all" for local dev convenience; in production config/env.js requires
// CORS_ORIGINS to be set, so a forgotten env var fails the boot instead of
// silently opening the API to every origin.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (allowedOrigins.length === 0 && !isProduction()) return callback(null, true);
      // Allow same-origin/non-browser requests (no Origin header) and listed origins.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '1mb' }));

// Baseline rate limiting across the API.
app.use('/api', apiLimiter);

// Health check. Reports the database too — a process that is listening but can't
// reach Mongo is not healthy, and a load balancer should know that.
app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    service: 'property-verse',
    database: dbUp ? 'connected' : 'disconnected',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/custom-fields', customFieldRoutes);
// Unauthenticated form submissions from the public Next.js web app. In
// production add that app's origin to CORS_ORIGINS so browsers can post here.
app.use('/api/public', publicRoutes);

// Unknown route → 404 JSON, not an HTML stack page.
app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Fallback error handler (e.g. multer file-size errors, CORS rejections).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  // Multer rejects oversized/too-many files with a code we can translate.
  if (err && err.name === 'MulterError') {
    return res.status(413).json({ error: 'That file is too large, or there were too many files.' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }

  console.error('Unhandled error:', err);
  // Never echo err.message: it carries stack-adjacent internals (driver errors,
  // file paths, query fragments). Errors that are safe to show set `expose`.
  const status = err && err.status >= 400 && err.status < 500 ? err.status : 500;
  const message = err && err.expose ? err.message : 'Internal server error.';
  res.status(status).json({ error: status === 500 ? 'Internal server error.' : message });
});

// Don't let an unhandled rejection crash the process silently.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const PORT = process.env.PORT || 5000;

// How often to sweep for overdue scheduled activities (default 5 min).
const SWEEP_INTERVAL_MS = Number(process.env.ACTIVITY_SWEEP_MS) || 5 * 60 * 1000;

// Guarded so `require`ing the app in a test doesn't open a port or a DB socket.
if (require.main === module) {
  connectDB()
    .then(() => {
      const server = app.listen(PORT, () =>
        console.log(`Property Verse backend running on port ${PORT}`)
      );

      // Keep the agenda honest: mark past-due scheduled activities as Missed.
      markOverdueActivities();
      const sweep = setInterval(markOverdueActivities, SWEEP_INTERVAL_MS);

      // Finish in-flight requests before the platform kills us.
      const shutdown = (signal) => {
        console.log(`${signal} received — shutting down.`);
        clearInterval(sweep);
        server.close(() => mongoose.connection.close(false).then(() => process.exit(0)));
        setTimeout(() => process.exit(1), 10000).unref();
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((err) => {
      console.error('Database connection error:', err);
      process.exit(1);
    });
}

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

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

const app = express();

// Secure HTTP headers.
app.use(helmet());

// CORS: restrict to an explicit allowlist in production; allow all only when no
// list is configured (local dev). Set CORS_ORIGINS to a comma-separated list.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No allowlist configured → permissive (dev). Otherwise enforce it.
      if (allowedOrigins.length === 0) return callback(null, true);
      // Allow same-origin/non-browser requests (no Origin header) and listed origins.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '1mb' }));

// Baseline rate limiting across the API.
app.use('/api', apiLimiter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'property-verse' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/uploads', uploadRoutes);

// Fallback error handler (e.g. multer file-size errors, CORS rejections).
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed.' });
  }
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

// Don't let an unhandled rejection crash the process silently.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const PORT = process.env.PORT || 5000;

// How often to sweep for overdue scheduled activities (default 5 min).
const SWEEP_INTERVAL_MS = Number(process.env.ACTIVITY_SWEEP_MS) || 5 * 60 * 1000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Property Verse backend running on port ${PORT}`));

    // Keep the agenda honest: mark past-due scheduled activities as Missed.
    markOverdueActivities();
    setInterval(markOverdueActivities, SWEEP_INTERVAL_MS);
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

module.exports = app;

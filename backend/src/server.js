require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const locationRoutes = require('./routes/locationRoutes');
const contactRoutes = require('./routes/contactRoutes');
const activityRoutes = require('./routes/activityRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'property-verse' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/activities', activityRoutes);

// Fallback error handler (e.g. multer file-size errors)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Property Verse backend running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection error:', err);
    process.exit(1);
  });

module.exports = app;

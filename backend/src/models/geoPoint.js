const mongoose = require('mongoose');

// A GeoJSON point plus the human-readable label and Google place id it came
// from. Reused by properties (their exact location) and leads (desired area).
// Coordinates are stored [longitude, latitude] per the GeoJSON spec.
const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: 'coordinates must be [lng, lat].',
      },
    },
    label: { type: String },
    placeId: { type: String },
  },
  { _id: false }
);

module.exports = geoPointSchema;

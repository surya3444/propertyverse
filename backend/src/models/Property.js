const mongoose = require('mongoose');
const geoPointSchema = require('./geoPoint');

const propertySchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  propertyType: {
    type: String,
    enum: ['Apartment', 'Villa', 'Commercial', 'Plot'],
    required: true
  },
  // Whether this listing is for sale or rent. `price` is the sale price; for
  // rentals the monthly rent/deposit/maintenance fields below apply.
  listingType: {
    type: String,
    enum: ['Sale', 'Rent'],
    default: 'Sale'
  },
  monthlyRent: { type: Number },
  deposit: { type: Number },
  maintenance: { type: Number },
  // The person who owns this listing (unified Contact).
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  // Human-readable location label (kept for display + backwards compatibility).
  location: {
    type: String,
    required: true
  },
  // Exact, disambiguated location with coordinates (set once the agent picks a
  // suggestion). `default: undefined` keeps it absent until chosen so the
  // 2dsphere index only covers geocoded properties.
  geo: {
    type: geoPointSchema,
    default: undefined
  },
  features: {
    bedrooms: Number,
    bathrooms: Number,
    balconies: Number,
    areaSqFt: Number, // built-up area
    carpetAreaSqFt: Number
  },
  furnishing: {
    type: String,
    enum: ['Unfurnished', 'Semi-furnished', 'Furnished']
  },
  floor: { type: Number },
  totalFloors: { type: Number },
  facing: {
    type: String,
    enum: ['North', 'East', 'South', 'West', 'North-East', 'North-West', 'South-East', 'South-West']
  },
  availableFrom: { type: Date },
  description: { type: String },
  amenities: { type: [String], default: [] },
  // Lifecycle status. `isAvailable` is kept in sync for the existing matching
  // engine (available = actively listed).
  status: {
    type: String,
    enum: ['Available', 'Under Offer', 'Sold', 'Rented'],
    default: 'Available'
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Enables geospatial "properties near this point" queries.
propertySchema.index({ geo: '2dsphere' });

module.exports = mongoose.model('Property', propertySchema);
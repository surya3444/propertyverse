const mongoose = require('mongoose');
const geoPointSchema = require('./geoPoint');

// A Cloudinary-hosted asset (photo or document) attached to a property.
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    resourceType: { type: String }, // 'image' | 'raw'
    format: { type: String },
    bytes: { type: Number },
    width: { type: Number },
    height: { type: Number },
    name: { type: String }, // original filename (mainly for documents)
    mimeType: { type: String },
  },
  { _id: false }
);

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
  // Keep in sync with the frontend PROPERTY_TYPES + the Gemini schema enums.
  propertyType: {
    type: String,
    enum: [
      'Apartment',
      'Independent House',
      'Villa',
      'Penthouse',
      'Studio',
      'Plot',
      'Land',
      'Farmhouse',
      'Commercial',
      'Office',
      'Shop',
      'Warehouse'
    ],
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
  // Cloudinary-hosted photos (first is the cover) and documents (floor plans,
  // agreements, brochures…).
  images: { type: [mediaSchema], default: [] },
  documents: { type: [mediaSchema], default: [] },
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
// Primary access pattern: an agent's inventory, newest first.
propertySchema.index({ agentId: 1, createdAt: -1 });
// Matching filters (available inventory by listing/type).
propertySchema.index({ agentId: 1, listingType: 1, propertyType: 1, isAvailable: 1 });
// Contact timeline lookups (properties an owner is linked to).
propertySchema.index({ agentId: 1, ownerId: 1 });

module.exports = mongoose.model('Property', propertySchema);
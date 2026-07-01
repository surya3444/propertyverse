const mongoose = require('mongoose');
const geoPointSchema = require('./geoPoint');

const leadSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming you'll have an Agent/User model later
    required: true
  },
  // The person this requirement belongs to (unified Contact). Optional so
  // legacy leads without a contact still load.
  contactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact'
  },
  clientName: {
    type: String,
    default: 'Unknown Client'
  },
  phoneNumber: {
    type: String,
    required: true,
    index: true
  },
  requirements: {
    // Whether the client wants to buy or rent.
    transactionType: { type: String, enum: ['Buy', 'Rent'], default: 'Buy' },
    budgetMax: { type: Number },
    propertyType: { type: String, enum: ['Apartment', 'Villa', 'Commercial', 'Plot', 'Any'] },
    location: { type: String },
    // Exact desired area with coordinates (set when the agent picks a
    // suggestion for the spoken/typed location). Absent = location is text-only.
    geo: { type: geoPointSchema, default: undefined },
    urgency: { type: String, enum: ['High', 'Medium', 'Low'] },
    rawAudioTranscript: { type: String } // Good for debugging or manual review
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Closed'],
    default: 'New'
  }
}, { timestamps: true });

// Enables geospatial "leads wanting an area near this point" queries.
leadSchema.index({ 'requirements.geo': '2dsphere' });

module.exports = mongoose.model('Lead', leadSchema);
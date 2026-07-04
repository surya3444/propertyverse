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
  },
  // How this lead was captured. Voice leads are AI-extracted and start unreviewed
  // so the UI can prompt the agent to confirm the machine-read requirements.
  // 'form' leads arrive from a public capture form (see Form model) and are
  // tagged so the agent can tell form-sourced records apart from ones they typed.
  source: {
    type: String,
    enum: ['voice', 'manual', 'form'],
    default: 'manual'
  },
  // The public form that produced this lead (only set when source === 'form').
  formId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Form'
  },
  // False for AI-extracted leads until the agent confirms/edits the requirements.
  reviewed: {
    type: Boolean,
    default: true
  },
  // When a lead is Closed against a specific property, we record which one so the
  // lead -> property -> deal loop is captured (not just a bare "Closed" status).
  closedPropertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  },
  // Agent-defined custom field values (keyed by CustomFieldDef field key).
  // Sanitized server-side against the agent's schema.
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Enables geospatial "leads wanting an area near this point" queries.
leadSchema.index({ 'requirements.geo': '2dsphere' });
// Primary access pattern: an agent's leads, filtered by status, newest first.
leadSchema.index({ agentId: 1, status: 1, createdAt: -1 });
// Contact timeline lookups (a contact's requirements).
leadSchema.index({ agentId: 1, contactId: 1 });

module.exports = mongoose.model('Lead', leadSchema);
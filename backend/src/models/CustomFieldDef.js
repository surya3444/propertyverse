const mongoose = require('mongoose');

// A single agent-defined custom field. `key` is the stable identifier stored on
// records' `customFields` map; `label` is what the agent sees. `aiExtract` fields
// are injected into the Gemini voice-extraction schema (services/geminiService.js)
// so voice notes can populate them. Shape mirrors Form's formFieldSchema.
const customFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'textarea', 'number', 'select', 'date', 'boolean'],
      default: 'text',
    },
    // Choices for `select` fields.
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    // Whether the voice AI should try to extract this field.
    aiExtract: { type: Boolean, default: true },
    // Optional hint that guides the AI (falls back to `label`).
    aiHint: { type: String },
  },
  { _id: false }
);

// One document per (agent, entityType) holding that agent's custom field schema
// for Properties, Leads, or Contacts. Read/created on demand by
// controllers/customFieldController.js.
const customFieldDefSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['property', 'lead', 'contact'],
      required: true,
    },
    fields: { type: [customFieldSchema], default: [] },
  },
  { timestamps: true }
);

// One schema doc per entity type per agent.
customFieldDefSchema.index({ agentId: 1, entityType: 1 }, { unique: true });

module.exports = mongoose.model('CustomFieldDef', customFieldDefSchema);

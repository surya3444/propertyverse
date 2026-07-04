const mongoose = require('mongoose');
const crypto = require('crypto');

// A conditional-visibility rule: the field it lives on is shown only when the
// answer to `field` (another field's key) satisfies `operator` against `values`.
// Absent = the field always shows. Enforced authoritatively on the backend
// (services/formService.js isFieldVisible) and mirrored live in the web form.
const visibleWhenSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ['equals', 'notEquals', 'in', 'notIn'],
      default: 'equals',
    },
    values: { type: [String], default: [] },
  },
  { _id: false }
);

// A single question on a capture form. `key` identifies the field: known keys map
// to Lead/Property/Contact fields (see services/formService.js); `custom: true`
// fields are free-form questions whose answers are stored on the response and
// appended to the record's notes/description.
const formFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'tel', 'email', 'number', 'select', 'textarea', 'file'],
      default: 'text',
    },
    required: { type: Boolean, default: false },
    // Hidden fields stay in the definition (so the agent can re-enable them) but
    // are not shown on the public form.
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    // Choices for `select` fields.
    options: { type: [String], default: [] },
    placeholder: { type: String },
    // True for agent-added questions that don't map to a model field.
    custom: { type: Boolean, default: false },
    // For `file` fields: what may be uploaded, and whether more than one.
    accept: {
      type: String,
      enum: ['image', 'document', 'any'],
      default: 'image',
    },
    multiple: { type: Boolean, default: false },
    // Optional conditional visibility (see visibleWhenSchema above).
    visibleWhen: { type: visibleWhenSchema, default: undefined },
  },
  { _id: false }
);

// A public capture form owned by an agent. `type` decides whether submissions
// become Leads (requirements) or Properties (listings). Reachable at
// /f/:publicId on the Next.js web app, which reads the definition and posts
// answers back to /api/public/forms/:publicId/submit.
const formSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['lead', 'property'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    // Unguessable public identifier used in the shareable URL. Generated once.
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(9).toString('base64url'),
    },
    // Brand accent used by the public form (defaults to the PropertyVerse orange).
    accentColor: { type: String, default: '#E9591C' },
    fields: { type: [formFieldSchema], default: [] },
    isActive: { type: Boolean, default: true },
    responseCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// List an agent's forms, newest first.
formSchema.index({ agentId: 1, createdAt: -1 });

module.exports = mongoose.model('Form', formSchema);

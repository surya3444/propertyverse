const CustomFieldDef = require('../models/CustomFieldDef');

const ENTITY_TYPES = ['property', 'lead', 'contact'];
const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'date', 'boolean'];

// Slugify a label into a stable, safe key when the client doesn't supply one.
function slugKey(label, i) {
  const base = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base ? `cf_${base}` : `cf_field_${i}`;
}

// Normalise an incoming custom-field definitions array: keep only known props,
// enforce valid types, ensure each field has a key, and re-index order. Drops
// fields with no label.
function sanitizeFieldDefs(fields) {
  if (!Array.isArray(fields)) return [];
  const seen = new Set();
  const out = [];
  fields.forEach((f, i) => {
    if (!f || typeof f !== 'object') return;
    const label = typeof f.label === 'string' ? f.label.trim() : '';
    if (!label) return;
    const type = FIELD_TYPES.includes(f.type) ? f.type : 'text';
    let key = typeof f.key === 'string' && f.key.trim() ? f.key.trim() : slugKey(label, i);
    // Guarantee uniqueness within the schema.
    while (seen.has(key)) key = `${key}_${i}`;
    seen.add(key);
    out.push({
      key,
      label,
      type,
      options:
        type === 'select' && Array.isArray(f.options)
          ? f.options.filter((o) => typeof o === 'string' && o.trim()).map((o) => o.trim())
          : [],
      required: !!f.required,
      order: typeof f.order === 'number' ? f.order : i,
      aiExtract: f.aiExtract !== false,
      aiHint: typeof f.aiHint === 'string' ? f.aiHint.trim() || undefined : undefined,
    });
  });
  return out;
}

// Coerce a raw value to the field's declared type. Returns undefined for blanks
// so empty answers don't clutter the stored map.
function coerceValue(field, raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  switch (field.type) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'boolean':
      if (typeof raw === 'boolean') return raw;
      return ['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase());
    case 'select': {
      const v = String(raw).trim();
      // Only accept values from the declared options.
      return field.options.includes(v) ? v : undefined;
    }
    case 'date':
    case 'text':
    case 'textarea':
    default:
      return String(raw).trim() || undefined;
  }
}

// Authoritative server-side sanitation of a record's custom values against the
// agent's schema: only keys defined in the schema survive, each coerced to its
// declared type. Never trusts arbitrary client keys.
function sanitizeCustomValues(values, fieldDefs) {
  if (!values || typeof values !== 'object' || !Array.isArray(fieldDefs)) return {};
  const out = {};
  for (const field of fieldDefs) {
    const v = coerceValue(field, values[field.key]);
    if (v !== undefined) out[field.key] = v;
  }
  return out;
}

// Fetch (or lazily create) an agent's schema for an entity type. Returns the
// mongoose doc.
async function getOrCreateDef(agentId, entityType) {
  let def = await CustomFieldDef.findOne({ agentId, entityType });
  if (!def) def = await CustomFieldDef.create({ agentId, entityType, fields: [] });
  return def;
}

// Just the fields array for an entity type (used by write paths + the AI layer).
async function getFieldDefs(agentId, entityType) {
  const def = await CustomFieldDef.findOne({ agentId, entityType }).lean();
  return def ? def.fields : [];
}

module.exports = {
  ENTITY_TYPES,
  FIELD_TYPES,
  sanitizeFieldDefs,
  sanitizeCustomValues,
  coerceValue,
  getOrCreateDef,
  getFieldDefs,
};

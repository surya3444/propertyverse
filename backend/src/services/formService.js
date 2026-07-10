const Form = require('../models/Form');
const Lead = require('../models/Lead');
const Property = require('../models/Property');
const { findOrCreateContact } = require('./contactService');
const cloudinaryService = require('./cloudinaryService');

// Property/requirement types. Owned by the matching engine so the form options,
// the model enums and the AI schema can never drift apart.
const { PROPERTY_TYPES, REQUIREMENT_TYPES } = require('./matchingService');

// The default questions for each form type. `key`s that aren't `custom` map to a
// model field in applyLeadSubmission / applyPropertySubmission below. Agents can
// hide/relabel/reorder these and add their own custom questions.
function defaultFields(type) {
  const withOrder = (fields) => fields.map((f, i) => ({ order: i, ...f }));

  if (type === 'property') {
    return withOrder([
      { key: 'ownerName', label: 'Your name', type: 'text' },
      { key: 'ownerPhone', label: 'Phone number', type: 'tel', required: true },
      { key: 'ownerEmail', label: 'Email', type: 'email' },
      { key: 'title', label: 'Property title', type: 'text', required: true },
      { key: 'propertyType', label: 'Property type', type: 'select', required: true, options: PROPERTY_TYPES },
      { key: 'listingType', label: 'For', type: 'select', options: ['Sale', 'Rent'] },
      { key: 'price', label: 'Expected price', type: 'number', required: true },
      { key: 'location', label: 'Location', type: 'text', required: true },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number' },
      { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
      { key: 'areaSqFt', label: 'Area (sq ft)', type: 'number' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ]);
  }

  // Lead / requirement form.
  return withOrder([
    { key: 'name', label: 'Your name', type: 'text', required: true },
    { key: 'phone', label: 'Phone number', type: 'tel', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'transactionType', label: 'Looking to', type: 'select', options: ['Buy', 'Rent'] },
    { key: 'propertyType', label: 'Property type', type: 'select', options: REQUIREMENT_TYPES },
    { key: 'budgetMax', label: 'Budget (max)', type: 'number' },
    { key: 'bedrooms', label: 'Bedrooms (BHK)', type: 'number' },
    { key: 'location', label: 'Preferred location', type: 'text' },
    { key: 'urgency', label: 'How soon?', type: 'select', options: ['High', 'Medium', 'Low'] },
    { key: 'notes', label: 'Anything else?', type: 'textarea' },
  ]);
}

const DEFAULT_TITLE = {
  lead: 'Tell us what you’re looking for',
  property: 'List your property with us',
};
const DEFAULT_DESCRIPTION = {
  lead: 'Share your requirement and we’ll find the right match for you.',
  property: 'Share your property details and we’ll get in touch.',
};

// Seed one lead + one property form for an agent that has none yet, so the list
// is never empty and the "default form for both" is always available.
async function ensureDefaultForms(agentId) {
  const count = await Form.countDocuments({ agentId });
  if (count > 0) return;
  await Form.create([
    { agentId, type: 'lead', title: DEFAULT_TITLE.lead, description: DEFAULT_DESCRIPTION.lead, fields: defaultFields('lead') },
    { agentId, type: 'property', title: DEFAULT_TITLE.property, description: DEFAULT_DESCRIPTION.property, fields: defaultFields('property') },
  ]);
}

// A missing/blank answer. File answers are arrays — blank when empty.
const isBlank = (v) => {
  if (Array.isArray(v)) return v.length === 0;
  return v === undefined || v === null || String(v).trim() === '';
};

// Evaluate a field's optional `visibleWhen` rule against the current answers.
// No rule = always visible. Comparison is string-based (answers come in as
// strings from the public form). Used to skip hidden fields on submit so a
// hidden required field is never "missing" and a hidden answer is never stored.
function isFieldVisible(field, values = {}) {
  const rule = field.visibleWhen;
  if (!rule || !rule.field) return true;
  const raw = values[rule.field];
  const current = raw === undefined || raw === null ? '' : String(raw).trim();
  const set = Array.isArray(rule.values) ? rule.values.map((v) => String(v)) : [];
  switch (rule.operator) {
    case 'notEquals':
      return current !== (set[0] ?? '');
    case 'in':
      return set.includes(current);
    case 'notIn':
      return !set.includes(current);
    case 'equals':
    default:
      return current === (set[0] ?? '');
  }
}

// A media descriptor uploaded via the public upload endpoint. We only trust the
// server-generated fields (a Cloudinary secure_url + public_id); everything else
// is cosmetic. Drops anything that isn't a plausible descriptor.
//
// The url must be one *we* issued. Accepting any https URL let a submitter put
// arbitrary links into a listing's images/documents, which the agent's app then
// renders — so the origin and cloud name are checked, not just the scheme.
function sanitizeMedia(raw) {
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((m) => m && typeof m === 'object' && cloudinaryService.isDeliveryUrl(m.url))
    .map((m) => ({
      url: m.url,
      publicId: typeof m.publicId === 'string' ? m.publicId : undefined,
      resourceType: typeof m.resourceType === 'string' ? m.resourceType : undefined,
      format: typeof m.format === 'string' ? m.format : undefined,
      bytes: typeof m.bytes === 'number' ? m.bytes : undefined,
      width: typeof m.width === 'number' ? m.width : undefined,
      height: typeof m.height === 'number' ? m.height : undefined,
      name: typeof m.name === 'string' ? m.name : undefined,
      mimeType: typeof m.mimeType === 'string' ? m.mimeType : undefined,
    }));
}

// Validate a public submission against a form's enabled + visible fields and
// split the answers into mapped values (by key), custom answers ({label,value}),
// and uploaded media grouped by accept kind. Throws a plain Error (message =
// user-facing) when a required, visible field is missing.
function mapSubmission(form, data = {}) {
  const values = {};
  const custom = [];
  const missing = [];
  // Media collected from `file` fields, grouped for the property media arrays.
  const media = { image: [], document: [] };

  for (const field of form.fields) {
    if (!field.enabled) continue;
    // Hidden-by-condition fields are dropped entirely (not required, not stored).
    if (!isFieldVisible(field, data)) continue;
    const raw = data[field.key];
    if (isBlank(raw)) {
      if (field.required) missing.push(field.label);
      continue;
    }

    if (field.type === 'file') {
      const files = sanitizeMedia(raw);
      if (!files.length) {
        if (field.required) missing.push(field.label);
        continue;
      }
      const bucket = field.accept === 'document' ? 'document' : 'image';
      media[bucket].push(...files);
      // Custom file questions still get a readable link block in notes.
      if (field.custom) {
        custom.push({ label: field.label, value: files.map((f) => f.url).join(', ') });
      }
      continue;
    }

    const value = typeof raw === 'string' ? raw.trim() : raw;

    // A `select` may only answer with one of its declared options. The built-in
    // keys were covered incidentally by the Mongoose enums, but an agent's own
    // select accepted any string the submitter cared to post.
    if (field.type === 'select' && field.options?.length && !field.options.includes(String(value))) {
      const err = new Error(`“${field.label}” must be one of the offered choices.`);
      err.status = 400;
      throw err;
    }

    if (field.custom) custom.push({ label: field.label, value });
    else values[field.key] = value;
  }

  if (missing.length) {
    const err = new Error(`Please fill in: ${missing.join(', ')}.`);
    err.status = 400;
    throw err;
  }
  return { values, custom, media };
}

// Render custom answers as a readable block appended to notes/description.
function customBlock(custom) {
  if (!custom.length) return '';
  return custom.map((c) => `${c.label}: ${c.value}`).join('\n');
}

const num = (v) => (isBlank(v) ? undefined : Number(v));

// A readable "Attachments:" block for records that have no media array (leads).
function mediaBlock(media) {
  const all = [...(media?.image || []), ...(media?.document || [])];
  if (!all.length) return '';
  return `Attachments:\n${all.map((m) => `- ${m.name || m.url}: ${m.url}`).join('\n')}`;
}

// Turn a validated lead submission into a Contact + Lead (source 'form').
async function applyLeadSubmission(agentId, form, values, custom, media) {
  const phone = values.phone;
  if (isBlank(phone)) {
    const err = new Error('A phone number is required.');
    err.status = 400;
    throw err;
  }
  const transactionType = values.transactionType === 'Rent' ? 'Rent' : 'Buy';
  const name = values.name || 'Website Lead';

  const contact = await findOrCreateContact(agentId, {
    name,
    phone,
    email: values.email,
    role: transactionType === 'Rent' ? 'Tenant' : 'Buyer',
  });

  const transcriptParts = [];
  if (!isBlank(values.notes)) transcriptParts.push(String(values.notes).trim());
  const block = customBlock(custom);
  if (block) transcriptParts.push(block);
  const attachments = mediaBlock(media);
  if (attachments) transcriptParts.push(attachments);

  const lead = await Lead.create({
    agentId,
    contactId: contact._id,
    phoneNumber: phone,
    clientName: name,
    source: 'form',
    formId: form._id,
    reviewed: true,
    status: 'New',
    requirements: {
      transactionType,
      budgetMax: num(values.budgetMax),
      propertyType: values.propertyType,
      bedrooms: num(values.bedrooms),
      location: values.location,
      urgency: values.urgency,
      rawAudioTranscript: transcriptParts.join('\n\n') || undefined,
    },
  });

  return { contact, lead };
}

// Turn a validated property submission into an (optional) owner Contact +
// Property (source 'form').
async function applyPropertySubmission(agentId, form, values, custom, media) {
  let ownerId;
  if (!isBlank(values.ownerPhone) || !isBlank(values.ownerName)) {
    const owner = await findOrCreateContact(agentId, {
      name: values.ownerName,
      phone: values.ownerPhone,
      email: values.ownerEmail,
      role: 'Owner',
    });
    ownerId = owner._id;
  }

  const listingType = values.listingType === 'Rent' ? 'Rent' : 'Sale';
  const price = num(values.price);

  const descriptionParts = [];
  if (!isBlank(values.description)) descriptionParts.push(String(values.description).trim());
  const block = customBlock(custom);
  if (block) descriptionParts.push(block);

  const property = await Property.create({
    agentId,
    ownerId,
    title: values.title,
    price,
    monthlyRent: listingType === 'Rent' ? price : undefined,
    propertyType: values.propertyType,
    listingType,
    location: values.location,
    features: {
      bedrooms: num(values.bedrooms),
      bathrooms: num(values.bathrooms),
      areaSqFt: num(values.areaSqFt),
    },
    description: descriptionParts.join('\n\n') || undefined,
    images: media?.image || [],
    documents: media?.document || [],
    source: 'form',
    formId: form._id,
  });

  return { ownerId, property };
}

module.exports = {
  PROPERTY_TYPES,
  REQUIREMENT_TYPES,
  defaultFields,
  ensureDefaultForms,
  isFieldVisible,
  mapSubmission,
  applyLeadSubmission,
  applyPropertySubmission,
};

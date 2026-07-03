const Form = require('../models/Form');
const Lead = require('../models/Lead');
const Property = require('../models/Property');
const { findOrCreateContact } = require('./contactService');

// Property types the Property model accepts. Keep in sync with
// models/Property.js + the frontend PROPERTY_TYPES.
const PROPERTY_TYPES = [
  'Apartment', 'Independent House', 'Villa', 'Penthouse', 'Studio', 'Plot',
  'Land', 'Farmhouse', 'Commercial', 'Office', 'Shop', 'Warehouse',
];
// Requirement types the Lead model accepts (a narrower set + "Any").
const REQUIREMENT_TYPES = ['Any', 'Apartment', 'Villa', 'Commercial', 'Plot'];

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

// A missing/blank answer.
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

// Validate a public submission against a form's enabled fields and split the
// answers into mapped values (by key) and custom answers ({label, value}).
// Throws a plain Error (message = user-facing) when a required field is missing.
function mapSubmission(form, data = {}) {
  const values = {};
  const custom = [];
  const missing = [];

  for (const field of form.fields) {
    if (!field.enabled) continue;
    const raw = data[field.key];
    if (isBlank(raw)) {
      if (field.required) missing.push(field.label);
      continue;
    }
    const value = typeof raw === 'string' ? raw.trim() : raw;
    if (field.custom) custom.push({ label: field.label, value });
    else values[field.key] = value;
  }

  if (missing.length) {
    const err = new Error(`Please fill in: ${missing.join(', ')}.`);
    err.status = 400;
    throw err;
  }
  return { values, custom };
}

// Render custom answers as a readable block appended to notes/description.
function customBlock(custom) {
  if (!custom.length) return '';
  return custom.map((c) => `${c.label}: ${c.value}`).join('\n');
}

const num = (v) => (isBlank(v) ? undefined : Number(v));

// Turn a validated lead submission into a Contact + Lead (source 'form').
async function applyLeadSubmission(agentId, form, values, custom) {
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
      location: values.location,
      urgency: values.urgency,
      rawAudioTranscript: transcriptParts.join('\n\n') || undefined,
    },
  });

  return { contact, lead };
}

// Turn a validated property submission into an (optional) owner Contact +
// Property (source 'form').
async function applyPropertySubmission(agentId, form, values, custom) {
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
  mapSubmission,
  applyLeadSubmission,
  applyPropertySubmission,
};

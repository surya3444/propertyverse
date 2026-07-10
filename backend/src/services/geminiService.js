const { GoogleGenAI } = require('@google/genai');

// Initialize the SDK with your API key.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Model is configurable so it can be pinned/upgraded per environment.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// An AI extraction error carries an HTTP status so controllers can surface a
// meaningful response instead of a blanket 500.
class AiExtractionError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'AiExtractionError';
    this.status = status;
  }
}

function assertConfigured() {
  if (!process.env.GEMINI_API_KEY) {
    throw new AiExtractionError(
      'Voice extraction is not configured. Set GEMINI_API_KEY in the backend .env.',
      503
    );
  }
}

// Call Gemini with a small retry for transient failures (rate limits / 5xx),
// then safely parse the JSON it returns. Never lets a raw parse error escape.
async function generateStructured({ prompt, audioBase64, mimeType, schema }) {
  assertConfigured();

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [
          { text: prompt },
          { inlineData: { data: audioBase64, mimeType } },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      });

      const text = response.text;
      if (!text || !text.trim()) {
        // Empty output usually means the audio was blocked or unintelligible.
        throw new AiExtractionError(
          'Could not understand the audio. Please re-record in a quieter setting.',
          422
        );
      }

      try {
        return JSON.parse(text);
      } catch {
        throw new AiExtractionError('The AI returned malformed data. Please try again.', 502);
      }
    } catch (err) {
      lastErr = err;
      // Don't retry deterministic client-side problems (bad/blocked audio).
      if (err instanceof AiExtractionError && err.status === 422) throw err;
      // Backoff before the next attempt.
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }

  if (lastErr instanceof AiExtractionError) throw lastErr;
  throw new AiExtractionError('Voice processing is temporarily unavailable. Please try again.');
}

// The property kinds we can classify into. The matching engine owns the list;
// the Property/Lead schemas and the frontend mirror it.
const { PROPERTY_TYPES, REQUIREMENT_TYPES } = require('./matchingService');

const LEAD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    budgetMax: { type: 'INTEGER', description: 'Maximum budget extracted as a number. E.g., 500000' },
    propertyType: { type: 'STRING', enum: REQUIREMENT_TYPES },
    bedrooms: {
      type: 'INTEGER',
      description: 'Desired number of bedrooms / BHK if the client mentions one (e.g. "3 BHK" -> 3)',
    },
    location: { type: 'STRING', description: 'City, neighborhood, or general area' },
    urgency: { type: 'STRING', enum: ['High', 'Medium', 'Low'] },
    clientName: { type: 'STRING', description: 'Name of the client if mentioned in the recording' },
    rawTranscript: { type: 'STRING', description: 'A plain-text transcript of what was said in the recording' },
  },
  required: ['budgetMax', 'propertyType', 'location', 'urgency'],
};

// Map an agent-defined custom field to a Gemini schema property. Only fields
// flagged aiExtract are included by the caller. Returns [key, propertySchema].
function customFieldToProp(field) {
  const description = field.aiHint || field.label;
  switch (field.type) {
    case 'number':
      return [field.key, { type: 'NUMBER', description }];
    case 'boolean':
      return [field.key, { type: 'BOOLEAN', description }];
    case 'select':
      return [
        field.key,
        field.options && field.options.length
          ? { type: 'STRING', enum: field.options, description }
          : { type: 'STRING', description },
      ];
    case 'date':
    case 'text':
    case 'textarea':
    default:
      return [field.key, { type: 'STRING', description }];
  }
}

// Build a nested `customFields` OBJECT property from the agent's schema so the
// model returns custom answers separate from the built-in ones. Returns null
// when there are no AI-extractable custom fields.
function buildCustomFieldsProp(fieldDefs = []) {
  const props = {};
  for (const f of fieldDefs) {
    if (f && f.aiExtract !== false && f.key && f.label) {
      const [key, schema] = customFieldToProp(f);
      props[key] = schema;
    }
  }
  if (!Object.keys(props).length) return null;
  return {
    type: 'OBJECT',
    description:
      'Additional agent-defined details. Only fill a field when the recording clearly mentions it; otherwise omit it.',
    properties: props,
  };
}

// Clone a base schema and inject a `customFields` property built from the agent's
// custom field definitions (no-op when there are none).
function withCustomFields(baseSchema, fieldDefs) {
  const custom = buildCustomFieldsProp(fieldDefs);
  if (!custom) return baseSchema;
  return {
    ...baseSchema,
    properties: { ...baseSchema.properties, customFields: custom },
  };
}

// Clamp/normalise AI output so obviously-bad values never reach the database.
function sanitizeLead(data) {
  const out = { ...data };
  if (out.budgetMax != null) {
    const n = Number(out.budgetMax);
    out.budgetMax = Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  }
  if (out.bedrooms != null) {
    const n = Number(out.bedrooms);
    out.bedrooms = Number.isFinite(n) && n > 0 && n < 50 ? Math.round(n) : undefined;
  }
  if (!REQUIREMENT_TYPES.includes(out.propertyType)) out.propertyType = 'Any';
  const urgencies = ['High', 'Medium', 'Low'];
  if (!urgencies.includes(out.urgency)) out.urgency = undefined;
  if (typeof out.location === 'string') out.location = out.location.trim() || undefined;
  return out;
}

const extractLeadFromAudio = async (audioBuffer, mimeType, customFieldDefs = []) => {
  const data = await generateStructured({
    prompt:
      "Listen to this real estate agent's voice note. Extract the client's requirements and output them exactly according to the provided JSON schema. If the schema includes a 'customFields' object, fill only the sub-fields the recording clearly mentions.",
    audioBase64: audioBuffer.toString('base64'),
    mimeType,
    schema: withCustomFields(LEAD_SCHEMA, customFieldDefs),
  });
  const out = sanitizeLead(data);
  // Pass custom answers through untouched; authoritative coercion happens in the
  // controller against the agent's schema (services/customFieldService.js).
  if (data.customFields && typeof data.customFields === 'object') out.customFields = data.customFields;
  return out;
};

const PROPERTY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A short listing title, e.g. "3 BHK Villa in Gandhi Nagar"' },
    listingType: {
      type: 'STRING',
      enum: ['Sale', 'Rent'],
      description:
        'Whether the property is being offered for sale or for rent. Choose "Rent" if the agent mentions rent, lease, monthly, per month, /mo, tenant, or a deposit; otherwise "Sale".',
    },
    price: {
      type: 'INTEGER',
      description:
        'The main amount as a number. For a Sale this is the asking price; for a Rent this is the MONTHLY rent. Convert lakh/crore to full digits (1 crore = 10000000, 1 lakh = 100000).',
    },
    deposit: { type: 'INTEGER', description: 'Security deposit amount for a rental, if mentioned.' },
    propertyType: { type: 'STRING', enum: PROPERTY_TYPES },
    location: { type: 'STRING', description: 'City, neighborhood, or general area mentioned' },
    bedrooms: { type: 'INTEGER', description: 'Number of bedrooms / BHK if mentioned' },
    bathrooms: { type: 'INTEGER', description: 'Number of bathrooms if mentioned' },
    areaSqFt: { type: 'INTEGER', description: 'Built-up / carpet area in square feet if mentioned' },
    rawTranscript: { type: 'STRING', description: 'A plain-text transcript of what was said' },
  },
  required: ['title', 'price', 'propertyType', 'location'],
};

function sanitizeProperty(data) {
  const out = { ...data };
  for (const key of ['price', 'deposit']) {
    if (out[key] != null) {
      const n = Number(out[key]);
      out[key] = Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
    }
  }
  if (!['Sale', 'Rent'].includes(out.listingType)) out.listingType = undefined;
  if (!PROPERTY_TYPES.includes(out.propertyType)) out.propertyType = undefined;
  for (const key of ['bedrooms', 'bathrooms', 'areaSqFt']) {
    if (out[key] != null) {
      const n = Number(out[key]);
      out[key] = Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
    }
  }
  if (typeof out.location === 'string') out.location = out.location.trim() || undefined;
  if (typeof out.title === 'string') out.title = out.title.trim() || undefined;
  return out;
}

const extractPropertyFromAudio = async (audioBuffer, mimeType, customFieldDefs = []) => {
  const data = await generateStructured({
    prompt:
      "Listen to this real estate agent's voice note describing a property they want to list. Extract the listing details and output them exactly according to the provided JSON schema. Pay close attention to whether it's for SALE or for RENT: words like rent, lease, monthly, per month, or a security deposit mean it's a rental (listingType 'Rent') and the amount stated is the monthly rent; otherwise treat it as a sale price. If the schema includes a 'customFields' object, fill only the sub-fields the recording clearly mentions.",
    audioBase64: audioBuffer.toString('base64'),
    mimeType,
    schema: withCustomFields(PROPERTY_SCHEMA, customFieldDefs),
  });
  const out = sanitizeProperty(data);
  if (data.customFields && typeof data.customFields === 'object') out.customFields = data.customFields;
  return out;
};

module.exports = { extractLeadFromAudio, extractPropertyFromAudio, AiExtractionError };

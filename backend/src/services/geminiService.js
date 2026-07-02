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

const LEAD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    budgetMax: { type: 'INTEGER', description: 'Maximum budget extracted as a number. E.g., 500000' },
    propertyType: { type: 'STRING', enum: ['Apartment', 'Villa', 'Commercial', 'Plot', 'Any'] },
    location: { type: 'STRING', description: 'City, neighborhood, or general area' },
    urgency: { type: 'STRING', enum: ['High', 'Medium', 'Low'] },
    clientName: { type: 'STRING', description: 'Name of the client if mentioned in the recording' },
    rawTranscript: { type: 'STRING', description: 'A plain-text transcript of what was said in the recording' },
  },
  required: ['budgetMax', 'propertyType', 'location', 'urgency'],
};

// Clamp/normalise AI output so obviously-bad values never reach the database.
function sanitizeLead(data) {
  const out = { ...data };
  if (out.budgetMax != null) {
    const n = Number(out.budgetMax);
    out.budgetMax = Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  }
  const types = ['Apartment', 'Villa', 'Commercial', 'Plot', 'Any'];
  if (!types.includes(out.propertyType)) out.propertyType = 'Any';
  const urgencies = ['High', 'Medium', 'Low'];
  if (!urgencies.includes(out.urgency)) out.urgency = undefined;
  if (typeof out.location === 'string') out.location = out.location.trim() || undefined;
  return out;
}

const extractLeadFromAudio = async (audioBuffer, mimeType) => {
  const data = await generateStructured({
    prompt:
      "Listen to this real estate agent's voice note. Extract the client's requirements and output them exactly according to the provided JSON schema.",
    audioBase64: audioBuffer.toString('base64'),
    mimeType,
    schema: LEAD_SCHEMA,
  });
  return sanitizeLead(data);
};

const PROPERTY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A short listing title, e.g. "3 BHK Villa in Gandhi Nagar"' },
    price: { type: 'INTEGER', description: 'Asking price as a number. Convert lakh/crore to full digits (1 crore = 10000000).' },
    propertyType: { type: 'STRING', enum: ['Apartment', 'Villa', 'Commercial', 'Plot'] },
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
  if (out.price != null) {
    const n = Number(out.price);
    out.price = Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  }
  const types = ['Apartment', 'Villa', 'Commercial', 'Plot'];
  if (!types.includes(out.propertyType)) out.propertyType = undefined;
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

const extractPropertyFromAudio = async (audioBuffer, mimeType) => {
  const data = await generateStructured({
    prompt:
      "Listen to this real estate agent's voice note describing a property they want to list. Extract the listing details and output them exactly according to the provided JSON schema.",
    audioBase64: audioBuffer.toString('base64'),
    mimeType,
    schema: PROPERTY_SCHEMA,
  });
  return sanitizeProperty(data);
};

module.exports = { extractLeadFromAudio, extractPropertyFromAudio, AiExtractionError };

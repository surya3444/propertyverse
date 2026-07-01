const { GoogleGenAI } = require('@google/genai');

// Initialize the SDK with your free API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const extractLeadFromAudio = async (audioBuffer, mimeType) => {
  const audioBase64 = audioBuffer.toString("base64");
  
  // Define the exact blueprint we want Gemini to follow
  const leadSchema = {
    type: "OBJECT",
    properties: {
      budgetMax: { type: "INTEGER", description: "Maximum budget extracted as a number. E.g., 500000" },
      propertyType: { type: "STRING", enum: ['Apartment', 'Villa', 'Commercial', 'Plot', 'Any'] },
      location: { type: "STRING", description: "City, neighborhood, or general area" },
      urgency: { type: "STRING", enum: ['High', 'Medium', 'Low'] },
      clientName: { type: "STRING", description: "Name of the client if mentioned in the recording" },
      rawTranscript: { type: "STRING", description: "A plain-text transcript of what was said in the recording" }
    },
    required: ["budgetMax", "propertyType", "location", "urgency"]
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: [
      { text: "Listen to this real estate agent's voice note. Extract the client's requirements and output them exactly according to the provided JSON schema." },
      {
        inlineData: {
          data: audioBase64,
          mimeType: mimeType
        }
      }
    ],
    config: {
      // Force the model to output strict JSON matching our schema
      responseMimeType: "application/json",
      responseSchema: leadSchema
    }
  });

  // Gemini returns a stringified JSON, parse it before returning
  return JSON.parse(response.text);
};

const extractPropertyFromAudio = async (audioBuffer, mimeType) => {
  const audioBase64 = audioBuffer.toString('base64');

  // Blueprint for a property listing spoken by the agent.
  const propertySchema = {
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { text: "Listen to this real estate agent's voice note describing a property they want to list. Extract the listing details and output them exactly according to the provided JSON schema." },
      { inlineData: { data: audioBase64, mimeType } },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: propertySchema,
    },
  });

  return JSON.parse(response.text);
};

module.exports = { extractLeadFromAudio, extractPropertyFromAudio };
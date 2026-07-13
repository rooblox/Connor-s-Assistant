// ai/openaiClient.js
// Shared OpenAI client so every AI feature uses the same setup.

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = openai;
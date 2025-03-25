const OpenAI = require('openai');
const config = require('../config');

// Create a single shared OpenAI client instance
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  maxConcurrentRequests: config.openai.rateLimiter.maxConcurrentRequests
});

// Add a unique identifier for this shared client instance
const clientId = Math.random().toString(36).substring(7);
console.log(`[Shared OpenAI Client] Created shared OpenAI client instance ${clientId}`);

// Export the shared instance
module.exports = openai;

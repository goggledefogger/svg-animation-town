const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

// Create a single shared Anthropic client instance
const anthropic = new Anthropic({
  apiKey: config.anthropic.apiKey,
  maxConcurrentRequests: config.anthropic.rateLimiter.maxConcurrentRequests
});

// Add a unique identifier for this shared client instance
const clientId = Math.random().toString(36).substring(7);
console.log(`[Shared Anthropic Client] Created shared Anthropic client instance ${clientId}`);

// Export the shared instance
module.exports = anthropic;

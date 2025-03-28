const { GoogleGenAI, Type } = require('@google/genai');
const config = require('../config');
const { RateLimiter } = require('../utils/rate-limiter');

// Track the number of active Gemini requests
let activeRequests = 0;

// Create a singleton rate limiter for Gemini API
const rateLimiter = new RateLimiter({
  tokensPerInterval: 60, // Adjust based on your quota
  interval: 60 * 1000, // 1 minute in milliseconds
  maxWaitTime: 30 * 1000 // 30 seconds max wait time
});

// Create a singleton instance of the Gemini client
const geminiClient = new GoogleGenAI({
  vertexai: false,
  apiKey: config.gemini.apiKey
});

// Track the active requests and return the client
const getGeminiClient = () => {
  activeRequests++;
  console.log(`[Gemini Client] Active requests: ${activeRequests}`);

  // Return an object with the client and a completion function
  return {
    client: geminiClient,
    completeRequest: () => {
      activeRequests--;
      console.log(`[Gemini Client] Request completed. Active requests: ${activeRequests}`);
    }
  };
};

// Function to manually decrement the counter
const completeRequest = () => {
  if (activeRequests > 0) {
    activeRequests--;
    console.log(`[Gemini Client] Request completed. Active requests: ${activeRequests}`);
  }
};

// Get rate limiter status
const getRateLimiterStatus = () => {
  return {
    availableTokens: rateLimiter.getAvailableTokens(),
    activeRequests
  };
};

module.exports = {
  geminiClient,
  getGeminiClient,
  completeRequest,
  Type,
  getRateLimiterStatus
};

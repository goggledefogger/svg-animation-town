const openAIService = require('./openai.service');
const claudeService = require('./claude.service');
const rateLimiter = require('./unified-rate-limiter.service');
const config = require('../config');
const { ServiceUnavailableError } = require('../utils/errors');

/**
 * Select the AI provider based on configuration
 * @returns {Object} The selected AI service
 */
const getAIService = () => {
  switch (config.aiProvider.toLowerCase()) {
    case 'openai':
      if (!config.openai.apiKey) {
        throw new ServiceUnavailableError('OpenAI API key is not configured');
      }
      return openAIService;

    case 'claude':
      if (!config.claude.apiKey) {
        throw new ServiceUnavailableError('Claude API key is not configured');
      }
      return claudeService;

    default:
      throw new ServiceUnavailableError(`Unknown AI provider: ${config.aiProvider}`);
  }
};

/**
 * AI Service wrapper that handles rate limiting for all providers
 */
const AIService = {
  /**
   * Generate animation with rate limiting
   * @param {string} prompt - The animation prompt
   * @returns {Promise<string>} The generated response
   */
  generateAnimation: async (prompt) => {
    const service = getAIService();
    const provider = config.aiProvider.toLowerCase();

    return rateLimiter.enqueueRequest(
      service.generateAnimation.bind(service),
      [prompt],
      provider
    );
  },

  /**
   * Update animation with rate limiting
   * @param {string} prompt - The update prompt
   * @param {string} currentSvg - Current SVG content
   * @returns {Promise<string>} The updated response
   */
  updateAnimation: async (prompt, currentSvg) => {
    const service = getAIService();
    const provider = config.aiProvider.toLowerCase();

    return rateLimiter.enqueueRequest(
      service.updateAnimation.bind(service),
      [prompt, currentSvg],
      provider
    );
  },

  /**
   * Get rate limiter status
   * @returns {Object} Current rate limiter status
   */
  getRateLimiterStatus: () => {
    return rateLimiter.getStatus();
  }
};

module.exports = AIService;

/**
 * Send a raw prompt to the AI service and receive the raw response
 * Used for more complex requests like storyboard generation
 *
 * @param {string} prompt - The prompt to send to the AI
 * @returns {string} - Raw text response from the AI
 */
exports.generateRawResponse = async (prompt) => {
  const service = getAIService();

  try {
    // First check if the service has a dedicated raw response method
    if (service.generateRawResponse) {
      const rawResponse = await service.generateRawResponse(prompt);

      if (!rawResponse || typeof rawResponse !== 'string') {
        console.error(`Error: ${config.aiProvider} returned invalid response type:`, typeof rawResponse);
        throw new ServiceUnavailableError('AI service returned an invalid response format');
      }

      // Check for common error indicators
      if (rawResponse.includes('<svg') || rawResponse.includes('</svg>')) {
        console.error(`Error: ${config.aiProvider} returned SVG content when JSON was expected`);
        throw new ServiceUnavailableError('Received SVG content instead of JSON. Please try again.');
      }

      return rawResponse;
    }

    // Fall back to using the generateAnimation method and extracting just the text
    const response = await service.generateAnimation(prompt);

    // If it's a string, return as is
    if (typeof response === 'string') {
      return response;
    }

    // If it's an object with an explanation property, return that
    if (response && response.explanation) {
      return response.explanation;
    }

    // If it has a message property, return that
    if (response && response.message) {
      return response.message;
    }

    // Otherwise stringify the whole object
    return JSON.stringify(response);
  } catch (error) {
    console.error(`Error generating raw response with ${config.aiProvider}:`, error);
    throw error;
  }
};

const openAIService = require('./openai.service');
const claudeService = require('./claude.service');
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
 * Generate a new SVG animation based on user prompt
 * Uses the configured AI provider
 *
 * @param {string} prompt - User's animation request
 * @returns {Object} AI provider response with SVG content
 */
exports.generateAnimation = async (prompt) => {
  const service = getAIService();
  try {
    return await service.generateAnimation(prompt);
  } catch (error) {
    console.error(`Error generating animation with ${config.aiProvider}:`, error);
    throw error;
  }
};

/**
 * Update an existing animation based on user prompt and previous SVG content
 * Uses the configured AI provider
 *
 * @param {string} prompt - User's animation update request
 * @param {string} currentSvg - Current SVG content (if any)
 * @returns {Object} AI provider response with updated SVG content
 */
exports.updateAnimation = async (prompt, currentSvg = '') => {
  const service = getAIService();
  try {
    return await service.updateAnimation(prompt, currentSvg);
  } catch (error) {
    console.error(`Error updating animation with ${config.aiProvider}:`, error);
    throw error;
  }
};

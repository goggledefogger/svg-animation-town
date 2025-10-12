const AIService = require('./ai.service');
const { extractSvgAndText } = require('../utils/parser');
const { v4: uuidv4 } = require('uuid');
const storageService = require('./storage.service');
const config = require('../config');
const { normalizeProvider, resolveModelId } = require('../utils/provider-utils');

/**
 * Animation Service handles generating and saving animations
 */
const AnimationService = {
  /**
   * Generate an animation from a text prompt
   * @param {string} prompt - The text prompt to generate an animation from
   * @param {string|Object} providerOrOptions - Optional provider override or configuration object
   * @returns {Promise<Object>} - Object containing SVG content, animation ID, and response message
   */
  generateAnimation: async (prompt, providerOrOptions) => {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const options = typeof providerOrOptions === 'string'
      ? { provider: providerOrOptions }
      : (providerOrOptions || {});

    const normalizedProvider = options.provider ? normalizeProvider(options.provider) : null;
    if (options.provider && !normalizedProvider) {
      console.warn(`[ANIMATION] Unknown provider override "${options.provider}". Falling back to default.`);
    }
    const providerKey = normalizedProvider || config.aiProvider;
    const providerConfig = config.providers[providerKey];

    if (!providerConfig) {
      throw new Error(`Provider configuration not found for ${providerKey}`);
    }

    const resolvedModel = resolveModelId(providerKey, options.model || providerConfig.model);

    // Use shorter trace logs with essential information only
    console.log(`[ANIMATION] Generating animation with ${providerKey} (${resolvedModel})`);

    try {
      const llmResponse = await AIService.generateAnimation(prompt, {
        provider: providerKey,
        model: resolvedModel
      });
      
      // Extract SVG and text from the response using the existing parser
      const { svg, text } = extractSvgAndText(llmResponse);
      
      if (!svg || !svg.includes('<svg')) {
        throw new Error('Failed to generate valid SVG content');
      }

      // Create animation chat history
      const chatHistory = [{
        id: uuidv4(),
        sender: 'user',
        text: prompt,
        timestamp: new Date()
      }, {
        id: uuidv4(),
        sender: 'ai',
        text: text || 'Animation created successfully',
        timestamp: new Date()
      }];

      // Generate animation ID
      const animationId = uuidv4();
      
      // Save animation to storage
      await storageService.saveAnimation({
        id: animationId,
        name: `Generated Animation: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}`,
        svg,
        prompt,
        timestamp: new Date().toISOString(),
        provider: providerKey,
        model: resolvedModel,
        chatHistory
      });
      
      console.log(`[ANIMATION] Created animation: ${animationId} (${svg.length} bytes)`);

      return {
        svg,
        animationId,
        message: text || 'Animation created successfully',
        provider: providerKey,
        model: resolvedModel
      };
    } catch (error) {
      console.error(`[ANIMATION] Error generating animation:`, error);
      throw error;
    }
  }
};

module.exports = AnimationService;

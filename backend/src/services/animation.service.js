const AIService = require('./ai.service');
const { extractSvgAndText } = require('../utils/parser');
const { v4: uuidv4 } = require('uuid');
const storageService = require('./storage.service');
const config = require('../config');

/**
 * Animation Service handles generating and saving animations
 */
const AnimationService = {
  /**
   * Generate an animation from a text prompt
   * @param {string} prompt - The text prompt to generate an animation from
   * @param {string} provider - Optional provider override
   * @returns {Promise<Object>} - Object containing SVG content, animation ID, and response message
   */
  generateAnimation: async (prompt, provider) => {
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Use shorter trace logs with essential information only
    console.log(`[ANIMATION] Generating animation with ${provider || config.aiProvider}`);

    try {
      // Use the existing AIService instead of trying to access aiProviders directly
      const aiProvider = provider || config.aiProvider;
      
      // Use existing AIService which handles provider selection internally
      let llmResponse;
      
      // Temporarily override the configured provider if specified
      const originalProvider = config.aiProvider;
      if (provider) {
        config.aiProvider = provider;
      }
      
      // Call the AI service to generate the animation
      llmResponse = await AIService.generateAnimation(prompt);
      
      // Restore the original provider if we temporarily changed it
      if (provider) {
        config.aiProvider = originalProvider;
      }
      
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
        provider: aiProvider,
        chatHistory
      });
      
      console.log(`[ANIMATION] Created animation: ${animationId} (${svg.length} bytes)`);

      return {
        svg,
        animationId,
        message: text || 'Animation created successfully'
      };
    } catch (error) {
      console.error(`[ANIMATION] Error generating animation:`, error);
      throw error;
    }
  }
};

module.exports = AnimationService;

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
   * Generate animation from a text prompt
   * @param {string} prompt - Text prompt to generate animation from
   * @param {string} provider - AI provider to use (openai or claude)
   * @returns {Promise<Object>} - Generated animation data with SVG and message
   */
  generateAnimation: async (prompt, provider) => {
    // Use the specified provider or fall back to default
    let llmResponse;
    
    if (provider && (provider === 'openai' || provider === 'claude')) {
      // Temporarily override the configured provider
      const originalProvider = config.aiProvider;
      config.aiProvider = provider;
      
      // Call the AI service to generate the animation
      llmResponse = await AIService.generateAnimation(prompt);
      
      // Restore the original provider
      config.aiProvider = originalProvider;
    } else {
      // Use the default provider
      llmResponse = await AIService.generateAnimation(prompt);
    }
    
    // Extract SVG and text from the response
    const { svg, text } = extractSvgAndText(llmResponse);
    
    if (!svg || !svg.includes('<svg')) {
      throw new Error('Failed to generate valid SVG content');
    }
    
    // Generate a name for the animation based on the prompt
    let animationName = prompt.trim();
    if (animationName.length > 40) {
      animationName = animationName.substring(0, 40) + '...';
    }
    
    // Create a simple chat history for the animation
    const chatHistory = [
      {
        id: uuidv4(),
        sender: 'user',
        text: prompt,
        timestamp: new Date()
      },
      {
        id: uuidv4(),
        sender: 'ai',
        text: text || 'Animation created successfully!',
        timestamp: new Date()
      }
    ];
    
    // Create animation object with ID before saving
    const animation = {
      id: uuidv4(), // Create an ID here instead of expecting the storage service to do it
      name: animationName,
      svg: svg,
      chatHistory: chatHistory,
      provider: provider || config.aiProvider,
      createdAt: new Date()
    };
    
    try {
      // Save the animation to storage
      const animationId = await storageService.saveAnimation(animation);
      
      // Return the generated animation with its ID
      return {
        svg: svg,
        message: text || 'Animation created successfully!',
        animationId: animationId || animation.id // Use fallback to ensure we always return an ID
      };
    } catch (error) {
      console.error('Error saving animation:', error);
      // Still return the SVG and message even if saving failed
      return {
        svg: svg,
        message: text || 'Animation created successfully!',
        animationId: animation.id,
        saveError: error.message
      };
    }
  }
};

module.exports = AnimationService; 
const OpenAIService = require('../services/openai.service');
const presetService = require('../services/preset.service');
const AIService = require('../services/ai.service');
const { extractSvgAndText } = require('../utils/parser');
const { asyncHandler, BadRequestError, NotFoundError, ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');

/**
 * Generate a new animation based on a text prompt
 */
exports.generateAnimation = asyncHandler(async (req, res) => {
  const { prompt, provider } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    // Override the default provider if one is specified in the request
    if (provider && (provider === 'openai' || provider === 'claude')) {
      // Temporarily override the configured provider
      const originalProvider = config.aiProvider;
      config.aiProvider = provider;

      console.log(`Using provider: ${provider} for animation generation`);

      // Call the AI service to generate the animation
      const llmResponse = await AIService.generateAnimation(prompt);

      // Restore the original provider
      config.aiProvider = originalProvider;

      // Extract SVG and text from the response
      const { svg, text } = extractSvgAndText(llmResponse);
      console.log(`Extracted SVG length: ${svg?.length || 0}, Text length: ${text?.length || 0}`);

      return res.status(200).json({
        success: true,
        svg,
        message: text
      });
    } else {
      // Use the default provider configured in the system
      const llmResponse = await AIService.generateAnimation(prompt);

      // Extract SVG and text from the response
      const { svg, text } = extractSvgAndText(llmResponse);

      return res.status(200).json({
        success: true,
        svg,
        message: text
      });
    }
  } catch (error) {
    console.error('Error generating animation:', error);
    throw new ServiceUnavailableError(`Failed to generate animation: ${error.message}`);
  }
});

/**
 * Update an existing animation based on a text prompt
 */
exports.updateAnimation = asyncHandler(async (req, res) => {
  const { prompt, currentSvg, provider } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    // Override the default provider if one is specified in the request
    if (provider && (provider === 'openai' || provider === 'claude')) {
      // Temporarily override the configured provider
      const originalProvider = config.aiProvider;
      config.aiProvider = provider;

      console.log(`Using provider: ${provider} for animation update`);

      // Call the AI service to update the animation
      const llmResponse = await AIService.updateAnimation(prompt, currentSvg);

      // Restore the original provider
      config.aiProvider = originalProvider;

      // Extract SVG and text from the response
      const { svg, text } = extractSvgAndText(llmResponse);
      console.log(`Extracted SVG length: ${svg?.length || 0}, Text length: ${text?.length || 0}`);

      return res.status(200).json({
        success: true,
        svg,
        message: text
      });
    } else {
      // Use the default provider configured in the system
      const llmResponse = await AIService.updateAnimation(prompt, currentSvg);

      // Extract SVG and text from the response
      const { svg, text } = extractSvgAndText(llmResponse);

      return res.status(200).json({
        success: true,
        svg,
        message: text
      });
    }
  } catch (error) {
    console.error('Error updating animation:', error);
    throw new ServiceUnavailableError(`Failed to update animation: ${error.message}`);
  }
});

/**
 * Get a preset animation
 */
exports.getPreset = asyncHandler(async (req, res) => {
  const { name } = req.params;
  const preset = await presetService.getPreset(name);

  if (!preset) {
    throw new NotFoundError(`Preset '${name}' not found`);
  }

  return res.status(200).json({
    success: true,
    preset
  });
});

const OpenAIService = require('../services/openai.service');
const presetService = require('../services/preset.service');
const { parseOpenAIResponse } = require('../utils/parser');
const { asyncHandler, BadRequestError, NotFoundError, ServiceUnavailableError } = require('../utils/errors');

/**
 * Generate a new animation based on a text prompt
 */
exports.generateAnimation = asyncHandler(async (req, res) => {
  const { prompt, currentElements = [] } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    // Call OpenAI to generate the animation
    const openaiResponse = await OpenAIService.generateAnimation(prompt, currentElements);

    // Parse the OpenAI response into our SVG element format
    const parsedElements = parseOpenAIResponse(openaiResponse);

    return res.status(200).json({
      success: true,
      elements: parsedElements.elements,
      message: parsedElements.message
    });
  } catch (error) {
    console.error('Error generating animation:', error);
    throw new ServiceUnavailableError(`Failed to generate animation: ${error.message}`);
  }
});

/**
 * Update an existing animation based on a text prompt
 */
exports.updateAnimation = asyncHandler(async (req, res) => {
  const { prompt, currentElements = [] } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  if (!currentElements || !currentElements.length) {
    throw new BadRequestError('Current elements are required for updates');
  }

  try {
    // Call OpenAI to update the animation
    const openaiResponse = await OpenAIService.updateAnimation(prompt, currentElements);

    // Parse the OpenAI response into our SVG element format
    const parsedElements = parseOpenAIResponse(openaiResponse);

    return res.status(200).json({
      success: true,
      elements: parsedElements.elements,
      message: parsedElements.message
    });
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

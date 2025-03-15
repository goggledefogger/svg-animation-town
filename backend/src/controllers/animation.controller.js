const OpenAIService = require('../services/openai.service');
const presetService = require('../services/preset.service');
const { extractSvgAndText } = require('../utils/parser');
const { asyncHandler, BadRequestError, NotFoundError, ServiceUnavailableError } = require('../utils/errors');

/**
 * Generate a new animation based on a text prompt
 */
exports.generateAnimation = asyncHandler(async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    // Call OpenAI to generate the animation
    const llmResponse = await OpenAIService.generateAnimation(prompt);

    // Extract SVG and text from the response
    const { svg, text } = extractSvgAndText(llmResponse);

    return res.status(200).json({
      success: true,
      svg,
      message: text
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
  const { prompt, currentSvg } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    // Call OpenAI to update the animation
    const llmResponse = await OpenAIService.updateAnimation(prompt, currentSvg);

    // Extract SVG and text from the response
    const { svg, text } = extractSvgAndText(llmResponse);

    return res.status(200).json({
      success: true,
      svg,
      message: text
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

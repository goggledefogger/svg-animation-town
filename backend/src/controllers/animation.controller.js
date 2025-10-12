const presetService = require('../services/preset.service');
const AIService = require('../services/ai.service');
const storageService = require('../services/storage.service');
const { extractSvgAndText } = require('../utils/parser');
const { asyncHandler, BadRequestError, NotFoundError, ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');
const { normalizeProvider, resolveModelId } = require('../utils/provider-utils');

/**
 * Generate a new animation based on a text prompt
 */
exports.generateAnimation = asyncHandler(async (req, res) => {
  const { prompt, provider, model } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    const normalizedProvider = provider ? normalizeProvider(provider) : null;
    const providerKey = normalizedProvider || config.aiProvider;
    const providerConfig = config.providers[providerKey];
    if (!providerConfig) {
      throw new ServiceUnavailableError(`Provider configuration not found for ${providerKey}`);
    }
    const resolvedModel = resolveModelId(providerKey, model || providerConfig?.model);

    if (provider && !normalizedProvider) {
      console.warn(`Unknown provider override "${provider}". Falling back to ${providerKey}.`);
    }

    const llmResponse = await AIService.generateAnimation(prompt, {
      provider: providerKey,
      model: resolvedModel
    });

    // Extract SVG and text from the response
    const { svg, text } = extractSvgAndText(llmResponse);

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
        timestamp: new Date().toISOString()
      },
      {
        id: uuidv4(),
        sender: 'ai',
        text: text || 'Animation generated successfully',
        timestamp: new Date().toISOString()
      }
    ];

    // Save the animation to storage
    const timestamp = new Date().toISOString();
    const animationId = await storageService.saveAnimation({
      id: uuidv4(),
      name: animationName,
      svg,
      chatHistory,
      provider: providerKey,
      model: resolvedModel,
      timestamp
    });

    // Log detailed information about the saved animation
    console.log(`Animation saved with ID: ${animationId}`, {
      nameLength: animationName.length,
      svgLength: svg.length,
      provider: providerKey,
      model: resolvedModel,
      timestamp
    });

    // Return the SVG, message, and the animation ID
    return res.status(200).json({
      success: true,
      svg,
      message: text,
      animationId,
      metadata: {
        provider: providerKey,
        model: resolvedModel
      }
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
  const { prompt, currentSvg, provider, model } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    const normalizedProvider = provider ? normalizeProvider(provider) : null;
    const providerKey = normalizedProvider || config.aiProvider;
    const providerConfig = config.providers[providerKey];
    if (!providerConfig) {
      throw new ServiceUnavailableError(`Provider configuration not found for ${providerKey}`);
    }
    const resolvedModel = resolveModelId(providerKey, model || providerConfig?.model);

    if (provider && !normalizedProvider) {
      console.warn(`Unknown provider override "${provider}". Falling back to ${providerKey}.`);
    }

    const llmResponse = await AIService.updateAnimation(prompt, currentSvg, {
      provider: providerKey,
      model: resolvedModel
    });

    // Extract SVG and text from the response
    const { svg, text } = extractSvgAndText(llmResponse);

    return res.status(200).json({
      success: true,
      svg,
      message: text,
      metadata: {
        provider: providerKey,
        model: resolvedModel
      }
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

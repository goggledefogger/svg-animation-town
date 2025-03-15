const OpenAI = require('openai');
const { getCommonInstructions, addExistingSvgToPrompt, getJsonResponseStructure, formatParsedResponse, generateErrorSvg } = require('../utils/prompt-builder');
const { ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Build OpenAI-specific system prompt
 *
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} OpenAI system prompt
 */
const buildOpenAISystemPrompt = (isUpdate = false) => {
  const commonInstructions = getCommonInstructions(isUpdate);

  return `${commonInstructions}

IMPORTANT: ${getJsonResponseStructure()}

Both fields are required. The "svg" field must contain a complete, valid SVG that can be directly inserted into a webpage.`;
};

/**
 * Build OpenAI-specific user prompt
 *
 * @param {string} userPrompt - User's animation request
 * @param {string} currentSvg - Current SVG content for updates
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} OpenAI user prompt
 */
const buildOpenAIUserPrompt = (userPrompt, currentSvg = '', isUpdate = false) => {
  let prompt = userPrompt;

  if (currentSvg && isUpdate) {
    prompt = addExistingSvgToPrompt(prompt, currentSvg);
    prompt += "\n\nPlease modify this SVG animation according to my request while preserving the overall structure.";
  }

  prompt += "\n\nRemember to respond with valid JSON containing 'explanation' and 'svg' fields.";

  return prompt;
};

/**
 * Process SVG generation or update with OpenAI
 *
 * @param {string} prompt - User's animation request
 * @param {string} currentSvg - Current SVG for updates (empty for new animations)
 * @param {boolean} isUpdate - Whether this is an update
 * @returns {string} Response with SVG content
 */
const processSvgWithOpenAI = async (prompt, currentSvg = '', isUpdate = false) => {
  if (!config.openai.apiKey) {
    throw new ServiceUnavailableError('OpenAI API key is not configured');
  }

  try {
    // Build prompts with OpenAI-specific instructions
    const systemPrompt = buildOpenAISystemPrompt(isUpdate);
    const userPrompt = buildOpenAIUserPrompt(prompt, currentSvg, isUpdate);

    console.log(`Sending ${isUpdate ? 'update' : 'creation'} request to OpenAI (${config.openai.model})`);

    // Adjust temperature slightly lower for updates to improve consistency
    const temperature = isUpdate
      ? Math.max(0.1, config.openai.temperature - 0.1)
      : config.openai.temperature;

    // Call OpenAI API with structured output
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: temperature,
      response_format: { type: "json_object" }
    });

    if (!completion.choices || !completion.choices.length) {
      console.warn('Empty response from OpenAI API');
      return generateErrorSvg('Empty response from AI', isUpdate ? currentSvg : null);
    }

    const responseContent = completion.choices[0].message.content;
    console.log(`OpenAI ${isUpdate ? 'update' : ''} response received, length:`, responseContent.length);

    // Parse the JSON response
    try {
      const parsedResponse = JSON.parse(responseContent);

      // Validate response has required fields
      if (!parsedResponse || !parsedResponse.svg) {
        console.warn('No SVG found in OpenAI response');
        return generateErrorSvg('Invalid response format', isUpdate ? currentSvg : null);
      }

      console.log(`Successfully received SVG ${isUpdate ? 'update' : ''} response`);
      return formatParsedResponse(parsedResponse);
    } catch (error) {
      console.error('Error parsing JSON response:', error);
      console.log('Raw response:', responseContent);
      // Return a formatted error instead of throwing
      return generateErrorSvg('Failed to parse response', isUpdate ? currentSvg : null);
    }
  } catch (error) {
    console.error('OpenAI API Error:', error);

    // Handle specific OpenAI error codes
    if (error.code === 'insufficient_quota') {
      throw new ServiceUnavailableError('OpenAI API quota exceeded. Please check your billing information.');
    }

    if (error.code === 'rate_limit_exceeded') {
      throw new ServiceUnavailableError('OpenAI API rate limit exceeded. Please try again later.');
    }

    if (error.code === 'invalid_api_key') {
      throw new ServiceUnavailableError('Invalid OpenAI API key. Please check your configuration.');
    }

    throw new ServiceUnavailableError(`OpenAI API Error: ${error.message}`);
  }
};

/**
 * Generate a new SVG animation based on user prompt
 *
 * @param {string} prompt - User's animation request
 * @returns {string} OpenAI response with SVG content
 */
exports.generateAnimation = async (prompt) => {
  return processSvgWithOpenAI(prompt, '', false);
};

/**
 * Update an existing animation based on user prompt and previous SVG content
 *
 * @param {string} prompt - User's animation update request
 * @param {string} currentSvg - Current SVG content (if any)
 * @returns {string} OpenAI response with updated SVG content
 */
exports.updateAnimation = async (prompt, currentSvg = '') => {
  return processSvgWithOpenAI(prompt, currentSvg, true);
};

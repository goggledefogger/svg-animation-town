const OpenAI = require('openai');
const { buildSystemPrompt, buildUserPrompt } = require('../utils/prompt-builder');
const { ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Generate a new animation based on user prompt
 * Uses GPT-4o-mini by default
 *
 * @param {string} prompt - User's animation request
 * @param {Array} currentElements - Current SVG elements (if any)
 * @returns {Object} OpenAI response
 */
exports.generateAnimation = async (prompt, currentElements = []) => {
  if (!config.openai.apiKey) {
    throw new ServiceUnavailableError('OpenAI API key is not configured');
  }

  try {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(prompt, currentElements);

    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
      response_format: { type: 'json_object' }
    });

    if (!completion.choices || !completion.choices.length) {
      throw new Error('Empty response from OpenAI API');
    }

    return completion.choices[0].message.content;
  } catch (error) {
    if (error.code === 'insufficient_quota') {
      throw new ServiceUnavailableError('OpenAI API quota exceeded. Please check your billing information.');
    }

    if (error.code === 'rate_limit_exceeded') {
      throw new ServiceUnavailableError('OpenAI API rate limit exceeded. Please try again later.');
    }

    if (error.code === 'invalid_api_key') {
      throw new ServiceUnavailableError('Invalid OpenAI API key. Please check your configuration.');
    }

    console.error('OpenAI API Error:', error);
    throw new ServiceUnavailableError(`OpenAI API Error: ${error.message}`);
  }
};

/**
 * Update an existing animation based on user prompt
 * Uses GPT-4o-mini by default
 *
 * @param {string} prompt - User's animation update request
 * @param {Array} currentElements - Current SVG elements
 * @returns {Object} OpenAI response
 */
exports.updateAnimation = async (prompt, currentElements) => {
  if (!config.openai.apiKey) {
    throw new ServiceUnavailableError('OpenAI API key is not configured');
  }

  try {
    const systemPrompt = buildSystemPrompt(true); // true for update mode
    const userPrompt = buildUserPrompt(prompt, currentElements, true); // true for update mode

    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
      response_format: { type: 'json_object' }
    });

    if (!completion.choices || !completion.choices.length) {
      throw new Error('Empty response from OpenAI API');
    }

    return completion.choices[0].message.content;
  } catch (error) {
    if (error.code === 'insufficient_quota') {
      throw new ServiceUnavailableError('OpenAI API quota exceeded. Please check your billing information.');
    }

    if (error.code === 'rate_limit_exceeded') {
      throw new ServiceUnavailableError('OpenAI API rate limit exceeded. Please try again later.');
    }

    if (error.code === 'invalid_api_key') {
      throw new ServiceUnavailableError('Invalid OpenAI API key. Please check your configuration.');
    }

    console.error('OpenAI API Error:', error);
    throw new ServiceUnavailableError(`OpenAI API Error: ${error.message}`);
  }
};

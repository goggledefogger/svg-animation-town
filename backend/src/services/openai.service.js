const openai = require('./shared-openai-client');
const { getCommonInstructions, addExistingSvgToPrompt, getJsonResponseStructure, formatParsedResponse, generateErrorSvg } = require('../utils/prompt-builder');
const { ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');

// Add a unique identifier for this client instance
const clientId = Math.random().toString(36).substring(7);
console.log(`[OpenAI Service] Created OpenAI client instance ${clientId}`);

// GPT-5 and O1 families currently require the Responses API instead of chat completions
const RESPONSES_MODEL_PREFIXES = ['o1', 'o3', 'gpt-5'];

const shouldUseResponsesApi = (modelId) => {
  if (typeof modelId !== 'string') {
    return false;
  }

  return RESPONSES_MODEL_PREFIXES.some(prefix => modelId.startsWith(prefix));
};

const buildResponsesPayload = (modelId, systemPrompt, userPrompt, temperature, maxTokens) => {
  const payload = {
    model: modelId,
    instructions: systemPrompt,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: userPrompt }
        ]
      }
    ],
    text: RESPONSES_JSON_TEXT_CONFIG,
    store: false,
    // Enable high reasoning effort for better SVG generation quality
    reasoning: {
      effort: 'high'
    }
  };

  console.log(`[OpenAI Service] Using Responses API with reasoning.effort: high`);

  if (typeof temperature === 'number') {
    payload.temperature = temperature;
  }

  if (typeof maxTokens === 'number') {
    payload.max_output_tokens = maxTokens;
  }

  return payload;
};

const RESPONSES_JSON_TEXT_CONFIG = {
  format: { type: 'json_object' }
};

const extractResponsesText = (response) => {
  if (!response) {
    return '';
  }

  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  const collectFromContentArray = (contentArray) => {
    const parts = [];

    for (const item of contentArray) {
      if (!item) continue;

      if (Array.isArray(item.content)) {
        parts.push(collectFromContentArray(item.content));
        continue;
      }

      if ((item.type === 'text' || item.type === 'output_text') && typeof item.text === 'string') {
        parts.push(item.text);
      }
    }

    return parts.join('');
  };

  if (Array.isArray(response.output)) {
    return collectFromContentArray(response.output).trim();
  }

  if (Array.isArray(response.content)) {
    return collectFromContentArray(response.content).trim();
  }

  return '';
};

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
const processSvgWithOpenAI = async (prompt, currentSvg = '', isUpdate = false, options = {}) => {
  if (!config.openai.apiKey) {
    throw new ServiceUnavailableError('OpenAI API key is not configured');
  }

  try {
    // Build prompts with OpenAI-specific instructions
    const systemPrompt = buildOpenAISystemPrompt(isUpdate);
    const userPrompt = buildOpenAIUserPrompt(prompt, currentSvg, isUpdate);

    console.log(`[OpenAI Service ${clientId}] Starting request with client instance ${clientId}`);
    console.log(`[OpenAI Service ${clientId}] Current active requests: ${openai.activeRequests || 0}`);

    const modelId = options.model || config.openai.model;

    // Check if temperature is explicitly set (including null to disable it)
    const hasTemperatureOverride = Object.prototype.hasOwnProperty.call(options, 'temperature');
    let requestTemperature;

    if (hasTemperatureOverride) {
      // If explicitly set to null, don't use temperature (model doesn't support it)
      if (options.temperature === null || options.temperature === undefined) {
        requestTemperature = undefined;
      } else if (typeof options.temperature === 'number') {
        requestTemperature = isUpdate
          ? Math.max(0.1, options.temperature - 0.1)
          : options.temperature;
      }
    } else {
      // No override, use config default
      if (typeof config.openai.temperature === 'number') {
        requestTemperature = isUpdate
          ? Math.max(0.1, config.openai.temperature - 0.1)
          : config.openai.temperature;
      }
    }

    const useResponsesApi = shouldUseResponsesApi(modelId);
    const maxTokens = typeof config.openai.maxTokens === 'number' ? config.openai.maxTokens : undefined;
    let responseContent = '';

    if (useResponsesApi) {
      const responsePayload = buildResponsesPayload(modelId, systemPrompt, userPrompt, requestTemperature, maxTokens);
      const response = await openai.responses.create(responsePayload);
      console.log(`[OpenAI Service ${clientId}] Responses API request completed`);
      responseContent = extractResponsesText(response);
    } else {
      const requestPayload = {
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      };

      if (typeof requestTemperature === 'number') {
        requestPayload.temperature = requestTemperature;
      }

      // Call OpenAI API with structured output
      const completion = await openai.chat.completions.create(requestPayload);

      console.log(`[OpenAI Service ${clientId}] Chat completions request completed`);

      if (!completion.choices || !completion.choices.length) {
        console.warn('Empty response from OpenAI API');
        return generateErrorSvg('Empty response from AI', isUpdate ? currentSvg : null);
      }

      responseContent = completion.choices[0].message.content;
    }

    if (!responseContent) {
      console.warn('Empty response content from OpenAI API');
      return generateErrorSvg('Empty response from AI', isUpdate ? currentSvg : null);
    }

    console.log(`OpenAI ${isUpdate ? 'update' : ''} response received, length:`, responseContent.length);

    if (useResponsesApi) {
      return responseContent;
    }

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
exports.generateAnimation = async (prompt, options = {}) => {
  return processSvgWithOpenAI(prompt, '', false, options);
};

/**
 * Update an existing animation based on user prompt and previous SVG content
 *
 * @param {string} prompt - User's animation update request
 * @param {string} currentSvg - Current SVG content (if any)
 * @returns {string} OpenAI response with updated SVG content
 */
exports.updateAnimation = async (prompt, currentSvg = '', options = {}) => {
  return processSvgWithOpenAI(prompt, currentSvg, true, options);
};

/**
 * Generate a raw text response from OpenAI without JSON formatting
 * Used specifically for storyboard generation and other JSON responses
 *
 * @param {string} prompt - The prompt to send to OpenAI
 * @returns {string} - Raw text response from OpenAI
 */
exports.generateRawResponse = async (prompt, options = {}) => {
  if (!config.openai.apiKey) {
    throw new ServiceUnavailableError('OpenAI API key is not configured');
  }

  try {
    console.log('Sending raw text request to OpenAI with JSON formatting hint');

    // Call OpenAI API requesting a JSON response but without structured output
    const modelId = options.model || config.openai.model;

    // Check if temperature is explicitly set (including null to disable it)
    const hasTemperatureOverride = Object.prototype.hasOwnProperty.call(options, 'temperature');
    let requestTemperature;

    if (hasTemperatureOverride) {
      // If explicitly set to null, don't use temperature (model doesn't support it)
      if (options.temperature === null || options.temperature === undefined) {
        requestTemperature = undefined;
      } else if (typeof options.temperature === 'number') {
        requestTemperature = options.temperature;
      }
    } else {
      // No override, use low default for JSON generation
      requestTemperature = 0.1;
    }

    const useResponsesApi = shouldUseResponsesApi(modelId);
    const maxTokens = typeof config.openai.maxTokens === 'number' ? config.openai.maxTokens : undefined;
    let responseContent = '';

    if (useResponsesApi) {
      const responsePayload = buildResponsesPayload(
        modelId,
        'You are a JSON generation assistant. Your responses should ONLY contain valid JSON with no surrounding text, no markdown formatting (like ```json), and no explanations. Just the raw JSON object.',
        prompt,
        requestTemperature,
        maxTokens
      );
      const response = await openai.responses.create(responsePayload);
      responseContent = extractResponsesText(response);
    } else {
      const requestPayload = {
        model: modelId,
        messages: [
          {
            role: 'system',
            content: 'You are a JSON generation assistant. Your responses should ONLY contain valid JSON with no surrounding text, no markdown formatting (like ```json), and no explanations. Just the raw JSON object.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" } // Request JSON formatted response
      };

      if (typeof requestTemperature === 'number') {
        requestPayload.temperature = requestTemperature;
      }

      const completion = await openai.chat.completions.create(requestPayload);

      if (!completion.choices || !completion.choices.length) {
        console.error('Empty response from OpenAI API');
        throw new ServiceUnavailableError('Received empty response from OpenAI API');
      }

      responseContent = completion.choices[0].message.content;
    }

    if (!responseContent) {
      console.error('Empty response from OpenAI API');
      throw new ServiceUnavailableError('Received empty response from OpenAI API');
    }

    console.log(`OpenAI raw response received, length: ${responseContent.length}`);

    // Make sure we don't have surrounding markdown code blocks
    const cleanedResponse = responseContent.replace(/```json|```/g, '').trim();

    // Validate that we have something that at least starts with a JSON object
    if (!cleanedResponse.startsWith('{')) {
      console.error('OpenAI response does not start with a JSON object');
      console.error('Response starts with:', cleanedResponse.substring(0, 100));
      throw new ServiceUnavailableError('Invalid JSON response from OpenAI: does not start with {');
    }

    return cleanedResponse;
  } catch (error) {
    console.error('OpenAI API Error in generateRawResponse:', error);

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

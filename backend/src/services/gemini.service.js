const { getGeminiClient, Type } = require('./shared-gemini-client');
const {
  getCommonInstructions,
  addExistingSvgToPrompt,
  getJsonResponseStructure,
  formatParsedResponse,
  generateErrorSvg
} = require('../utils/prompt-builder');
const { ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');
const { RateLimiter } = require('../utils/rate-limiter');

// Create a rate limiter specifically for Gemini SVG generation
const svgRateLimiter = new RateLimiter({
  tokensPerInterval: 20, // Adjust based on your quota
  interval: 60 * 1000, // 1 minute in milliseconds
  maxWaitTime: 30 * 1000 // 30 seconds max wait time
});

// Add a unique identifier for this client instance
const clientId = Math.random().toString(36).substring(7);
console.log(`[Gemini Service] Created client instance ${clientId}`);

/**
 * Build Gemini-specific system prompt
 *
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} Gemini system prompt
 */
const buildGeminiSystemPrompt = (isUpdate = false) => {
  const commonInstructions = getCommonInstructions(isUpdate);

  return `${commonInstructions}

IMPORTANT: ${getJsonResponseStructure()}

Both fields are required. The "svg" field must contain a complete, valid SVG that can be directly inserted into a webpage.`;
};

/**
 * Build Gemini-specific user prompt
 *
 * @param {string} userPrompt - User's animation request
 * @param {string} currentSvg - Current SVG content for updates
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} Gemini user prompt
 */
const buildGeminiUserPrompt = (userPrompt, currentSvg = '', isUpdate = false) => {
  let prompt = userPrompt;

  if (currentSvg && isUpdate) {
    prompt = addExistingSvgToPrompt(prompt, currentSvg);
    prompt += "\n\nPlease modify this SVG animation according to my request while preserving the overall structure.";
  }

  return prompt;
};

/**
 * Process SVG generation or update with Gemini
 *
 * @param {string} prompt - User's animation request
 * @param {string} currentSvg - Current SVG for updates (empty for new animations)
 * @param {boolean} isUpdate - Whether this is an update
 * @returns {string} Response with SVG content
 */
const processSvgWithGemini = async (prompt, currentSvg = '', isUpdate = false) => {
  if (!config.gemini.apiKey) {
    throw new ServiceUnavailableError('Gemini API key is not configured');
  }

  try {
    // Wait for rate limiter token
    await svgRateLimiter.acquireToken();
    console.log('[Gemini Service] Rate limit token acquired, sending request');

    // Build prompts with Gemini-specific instructions
    const systemPrompt = buildGeminiSystemPrompt(isUpdate);
    const userPrompt = buildGeminiUserPrompt(prompt, currentSvg, isUpdate);

    console.log(`[Gemini Service ${clientId}] Starting request`);

    // Get Gemini client with tracking
    const { client, completeRequest } = getGeminiClient();

    try {
      // Call Gemini API with proper structured output configuration
      const result = await client.models.generateContent({
        model: config.gemini.model,
        contents: `${systemPrompt}\n\n${userPrompt}`,
        generationConfig: {
          temperature: isUpdate ? Math.max(0.1, config.gemini.temperature - 0.1) : config.gemini.temperature,
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.STRING,
                description: "A brief explanation of the animation or the changes made"
              },
              svg: {
                type: Type.STRING,
                description: "The complete SVG code with animations"
              }
            },
            required: ['explanation', 'svg'],
          },
        }
      });

      console.log(`[Gemini Service ${clientId}] Request completed`);

      const text = result.text;

      if (!text) {
        console.warn('Empty response from Gemini API');
        return generateErrorSvg('Empty response from AI', isUpdate ? currentSvg : null);
      }

      try {
        // Since we're using structured output, the response should be JSON
        const parsedResponse = JSON.parse(text);

        if (!parsedResponse || !parsedResponse.svg) {
          console.warn('No SVG found in Gemini parsed response');
          return generateErrorSvg('Invalid response format', isUpdate ? currentSvg : null);
        }

        console.log(`Successfully received SVG ${isUpdate ? 'update' : ''} response`);
        return formatParsedResponse(parsedResponse);
      } catch (parseError) {
        console.error('Error parsing JSON from Gemini response:', parseError);
        console.error('Raw response:', text);

        // Fall back to regex extraction if JSON parsing fails
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const jsonStr = jsonMatch[0];
            const extractedResponse = JSON.parse(jsonStr);

            if (extractedResponse && extractedResponse.svg) {
              console.log('Successfully extracted SVG using regex fallback');
              return formatParsedResponse(extractedResponse);
            }
          } catch (e) {
            console.error('Failed to extract JSON with regex fallback:', e);
          }
        }

        return generateErrorSvg('Failed to parse response', isUpdate ? currentSvg : null);
      }
    } finally {
      // Always decrement the counter, even if there was an error
      completeRequest();
    }
  } catch (error) {
    console.error('Gemini API Error:', error);

    // Handle specific error types
    if (error.message && error.message.includes('API key')) {
      throw new ServiceUnavailableError('Invalid Gemini API key. Please check your configuration.');
    }

    if (error.message && error.message.includes('quota')) {
      throw new ServiceUnavailableError('Gemini API quota exceeded. Please check your billing information.');
    }

    if (error.message && error.message.includes('rate limit')) {
      throw new ServiceUnavailableError('Gemini API rate limit exceeded. Please try again later.');
    }

    throw new ServiceUnavailableError(`Gemini API Error: ${error.message}`);
  }
};

/**
 * Generate a new SVG animation based on user prompt
 *
 * @param {string} prompt - User's animation request
 * @returns {string} Gemini response with SVG content
 */
exports.generateAnimation = async (prompt) => {
  return processSvgWithGemini(prompt, '', false);
};

/**
 * Update an existing animation based on user prompt and previous SVG content
 *
 * @param {string} prompt - User's animation update request
 * @param {string} currentSvg - Current SVG content (if any)
 * @returns {string} Gemini response with updated SVG content
 */
exports.updateAnimation = async (prompt, currentSvg = '') => {
  return processSvgWithGemini(prompt, currentSvg, true);
};

/**
 * Generate a raw text response from Gemini without JSON formatting
 * Used specifically for storyboard generation and other JSON responses
 *
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {string} - Raw text response from Gemini
 */
exports.generateRawResponse = async (prompt) => {
  if (!config.gemini.apiKey) {
    throw new ServiceUnavailableError('Gemini API key is not configured');
  }

  try {
    // Wait for rate limiter token
    await svgRateLimiter.acquireToken();
    console.log('[Gemini Service] Rate limit token acquired for raw response');

    // Get Gemini client with tracking
    const { client, completeRequest } = getGeminiClient();

    try {
      // Prepare prompt with instructions
      const systemInstructions = "You are a JSON generation assistant. Your responses should ONLY contain valid JSON with no surrounding text, no markdown formatting (like ```json), and no explanations. Just the raw JSON object.";
      const userPromptWithInstructions = prompt;

      // Call Gemini API with proper structured output configuration for JSON
      const result = await client.models.generateContent({
        model: config.gemini.model,
        contents: `${systemInstructions}\n\n${userPromptWithInstructions}`,
        generationConfig: {
          temperature: 0.1, // Lower temperature for more deterministic JSON responses
        },
        config: {
          responseMimeType: 'application/json'
        }
      });

      if (!result) {
        console.error('Empty response from Gemini API');
        throw new ServiceUnavailableError('Received empty response from Gemini API');
      }

      const responseContent = result.text;
      console.log(`Gemini raw response received, length: ${responseContent.length}`);

      // Make sure we don't have surrounding markdown code blocks
      const cleanedResponse = responseContent.replace(/```json|```/g, '').trim();

      // Validate that we have something that at least starts with a JSON object or array
      if (!cleanedResponse.startsWith('{') && !cleanedResponse.startsWith('[')) {
        console.error('Gemini response does not start with a JSON object or array');
        console.error('Response starts with:', cleanedResponse.substring(0, 100));
        throw new ServiceUnavailableError('Invalid JSON response from Gemini: does not start with { or [');
      }

      return cleanedResponse;
    } finally {
      // Always decrement the counter, even if there was an error
      completeRequest();
    }
  } catch (error) {
    console.error('Gemini API Error in generateRawResponse:', error);

    // Handle specific error types
    if (error.message && error.message.includes('API key')) {
      throw new ServiceUnavailableError('Invalid Gemini API key. Please check your configuration.');
    }

    if (error.message && error.message.includes('quota')) {
      throw new ServiceUnavailableError('Gemini API quota exceeded. Please check your billing information.');
    }

    if (error.message && error.message.includes('rate limit')) {
      throw new ServiceUnavailableError('Gemini API rate limit exceeded. Please try again later.');
    }

    throw new ServiceUnavailableError(`Gemini API Error: ${error.message}`);
  }
};

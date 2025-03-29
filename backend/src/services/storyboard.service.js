const openai = require('./shared-openai-client');
const { ServiceUnavailableError, BadRequestError } = require('../utils/errors');
const config = require('../config');
const { getGeminiClient, Type } = require('./shared-gemini-client');
const unifiedRateLimiter = require('./unified-rate-limiter.service');
const anthropic = require('./shared-claude-client');

// Add a unique identifier for this client instance
const clientId = Math.random().toString(36).substring(7);
console.log(`[Storyboard Service] Created client instance ${clientId}`);

/**
 * Create system prompt for storyboard generation
 * @returns {string} System prompt
 */
const createSystemPrompt = () => {
  return `You are a storyboard generator for movies.
Your job is to create a cohesive, engaging storyboard based on a movie concept.
You will return a JSON structure that describes the complete movie and its scenes.

Each scene should:
1. Tell part of a cohesive story that flows naturally from one scene to the next
2. Have a clear description of what happens in that scene
3. Include a detailed SVG prompt that will be used to generate the animation

The SVG prompts should:
1. Be detailed and specific about what elements should be in the scene
2. Describe any motion or animation that should occur
3. Focus on simple, clear visuals that can be represented in SVG format
4. Avoid complex textures, gradients, or photorealistic elements

NEVER generate SVG content or code. Only generate a JSON structure.`;
};

/**
 * Create user prompt for storyboard generation
 * @param {string} prompt - Movie concept prompt
 * @param {number} numScenes - Number of scenes to generate (optional)
 * @returns {string} User prompt
 */
const createUserPrompt = (prompt, numScenes) => {
  let scenesInstruction = '';

  if (numScenes) {
    // If numScenes is specified, include it in the prompt
    scenesInstruction = `3. Include EXACTLY ${numScenes} scene${numScenes > 1 ? 's' : ''} that tell a cohesive story.`;
  } else {
    // If numScenes is not specified, use the default range
    scenesInstruction = '3. Include 3-7 scenes that tell a cohesive story.';
  }

  return `Create a storyboard for this movie concept: "${prompt}"

IMPORTANT INSTRUCTIONS:
1. ONLY return valid JSON with this EXACT structure (no other text):
{
  "title": "Movie title",
  "description": "Overall description of the movie and its story arc",
  "scenes": [
    {
      "id": "scene1",
      "description": "Detailed description of what happens in this scene",
      "svgPrompt": "Detailed prompt for generating an SVG animation of this scene",
      "duration": 5
    }
  ]
}

2. Each scene needs those exact fields.
${scenesInstruction}
4. Make each scene's "description" tell part of a cohesive story that flows naturally from one scene to the next.
5. For each scene's "svgPrompt", write a detailed prompt that describes:
   - What visual elements should be in the scene
   - How those elements should move or animate
   - Keep the visuals simple and SVG-friendly (basic shapes, lines, paths)
   - Avoid complex textures, gradients, or photorealistic elements
6. Set appropriate "duration" for each scene (in seconds) based on its complexity.`;
};

/**
 * Validate common requirements for storyboard generation
 * @param {string} prompt - Movie concept prompt
 * @param {string} apiKey - API key for the provider
 * @param {string} provider - Provider name for error messages
 */
const validateStoryboardRequest = (prompt, apiKey, provider) => {
  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  if (!apiKey) {
    throw new ServiceUnavailableError(`${provider} API key is not configured`);
  }
};

/**
 * Process and validate storyboard response
 * @param {Object} storyboard - Storyboard object
 * @returns {Object} Validated and processed storyboard
 */
const processStoryboard = (storyboard) => {
  // Validate storyboard structure
  if (!storyboard.title || !storyboard.description || !Array.isArray(storyboard.scenes)) {
    const missing = [];
    if (!storyboard.title) missing.push('title');
    if (!storyboard.description) missing.push('description');
    if (!Array.isArray(storyboard.scenes)) missing.push('scenes array');

    console.error('Invalid storyboard structure:', missing.join(', '));
    throw new ServiceUnavailableError(`Invalid storyboard format: missing ${missing.join(', ')}`);
  }

  // Validate scenes
  if (storyboard.scenes.length === 0) {
    throw new ServiceUnavailableError('Storyboard contains no scenes');
  }

  // Process each scene to ensure it has required properties
  storyboard.scenes = storyboard.scenes.map((scene, index) => {
    // Create a sanitized scene object
    return {
      id: scene.id || `scene${index + 1}`,
      description: scene.description || `Scene ${index + 1}`,
      svgPrompt: scene.svgPrompt || `Create an animation for scene ${index + 1}`,
      duration: typeof scene.duration === 'number' ? scene.duration : 5
    };
  });

  return storyboard;
};

/**
 * Generate a storyboard using OpenAI
 * Completely separate from SVG generation flow
 *
 * @param {string} prompt - Movie concept prompt
 * @param {number} numScenes - Optional number of scenes to generate
 * @returns {Object} Storyboard object with title, description, and scenes
 */
exports.generateStoryboardWithOpenAI = async (prompt, numScenes) => {
  validateStoryboardRequest(prompt, config.openai.apiKey, 'OpenAI');

  try {
    console.log('[Storyboard Service] Using unified rate limiter for OpenAI request');

    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(prompt, numScenes);

    console.log(`[Storyboard Service ${clientId}] Starting request with client instance ${clientId}`);
    console.log(`[Storyboard Service ${clientId}] Current active requests: ${openai.activeRequests || 0}`);

    // Use the unified rate limiter to make the request
    const completion = await unifiedRateLimiter.executeRequest(
      async () => {
        // Use the OpenAI API with JSON response format
        return await openai.chat.completions.create({
          model: config.openai.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          response_format: { type: "json_object" }
        });
      },
      [config.openai.model, systemPrompt, userPrompt], // Args for caching/deduplication
      'openai' // Provider name for rate limiting
    );

    console.log(`[Storyboard Service ${clientId}] Request completed`);

    if (!completion.choices || !completion.choices.length) {
      console.error('Empty response from OpenAI API');
      throw new ServiceUnavailableError('Received empty response from OpenAI');
    }

    const responseContent = completion.choices[0].message.content;
    console.log(`Received storyboard JSON response (${responseContent.length} chars)`);

    // Parse and validate the JSON response
    let storyboard;
    try {
      storyboard = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Response content:', responseContent);
      throw new ServiceUnavailableError('Failed to parse storyboard JSON response');
    }

    storyboard = processStoryboard(storyboard);

    return storyboard;

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

    // Re-throw the error if it's already a ServiceUnavailableError
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(`Failed to generate storyboard: ${error.message}`);
  }
};

/**
 * Generate a storyboard using Claude
 *
 * @param {string} prompt - Movie concept prompt
 * @param {number} numScenes - Optional number of scenes to generate
 * @returns {Object} Storyboard object with title, description and scenes
 */
exports.generateStoryboardWithClaude = async (prompt, numScenes) => {
  validateStoryboardRequest(prompt, config.claude.apiKey, 'Claude');

  try {
    console.log('[Storyboard Service] Using unified rate limiter for Claude request');
    
    // Strategic log #1: Log the current service state before Claude API call
    console.log(`[CLAUDE_DEBUG] Sending request to Claude with provider: ${config.aiProvider}, fallback available: ${config.aiProvider !== 'claude'}, token: ${config.claude.apiKey ? 'valid' : 'missing'}`);

    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(prompt, numScenes);

    console.log('Sending storyboard generation request to Claude');
    console.log(`Using prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    
    // Use the unified rate limiter to make the request
    const completion = await unifiedRateLimiter.executeRequest(
      async () => {
        return await anthropic.messages.create({
          model: config.claude.model,
          max_tokens: config.claude.maxTokens,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7
        });
      },
      [config.claude.model, systemPrompt, userPrompt], // Args for caching/deduplication
      'claude' // Provider name for rate limiting
    );

    if (!completion.content || completion.content.length === 0) {
      console.error('Empty response from Claude API');
      throw new ServiceUnavailableError('Received empty response from Claude');
    }

    // Extract the text response from the content array
    const contentBlock = completion.content.find(block => block.type === 'text');
    if (!contentBlock || !contentBlock.text) {
      console.error('No text content in Claude response');
      throw new ServiceUnavailableError('No text content in Claude response');
    }

    const responseContent = contentBlock.text;
    console.log(`Received storyboard response from Claude (${responseContent.length} chars)`);

    // Parse and validate the JSON response
    let storyboard;
    try {
      // First try direct JSON parsing, but trim any potential whitespace and common wrappers
      const cleanedResponse = responseContent
        .trim()
        .replace(/^```(json)?|```$/g, '') // Remove code block markers
        .trim();

      try {
        storyboard = JSON.parse(cleanedResponse);
        console.log('Successfully parsed JSON after cleaning response');
      } catch (innerError) {
        // If that fails, try direct JSON parsing of the original response
        storyboard = JSON.parse(responseContent);
        console.log('Successfully parsed direct JSON response');
      }
    } catch (parseError) {
      console.error('Failed to parse direct JSON response:', parseError);

      // If direct parsing fails, try to extract JSON from the response using regex
      const jsonRegex = /\{(?:[^{}]|(\{(?:[^{}]|(\{(?:[^{}]|(\{[^{}]*\}))*\}))*\}))*\}/g;
      const jsonMatches = responseContent.match(jsonRegex);

      if (jsonMatches && jsonMatches.length > 0) {
        // Try to parse the largest JSON match (likely the full storyboard)
        const sortedMatches = [...jsonMatches].sort((a, b) => b.length - a.length);

        try {
          storyboard = JSON.parse(sortedMatches[0]);
          console.log('Successfully extracted JSON using regex');
        } catch (regexParseError) {
          console.error('Failed to parse extracted JSON:', regexParseError);

          // Try one more approach - look for code blocks
          const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
          const codeBlockMatch = responseContent.match(codeBlockRegex);

          if (codeBlockMatch && codeBlockMatch[1]) {
            try {
              storyboard = JSON.parse(codeBlockMatch[1].trim());
              console.log('Successfully extracted JSON from code block');
            } catch (codeBlockError) {
              console.error('Failed to parse JSON from code block:', codeBlockError);
              throw new ServiceUnavailableError('Failed to parse storyboard JSON response');
            }
          } else {
            throw new ServiceUnavailableError('Failed to extract storyboard JSON from Claude response');
          }
        }
      } else {
        console.error('No JSON found in Claude response');
        throw new ServiceUnavailableError('Failed to extract storyboard JSON from Claude response');
      }
    }

    storyboard = processStoryboard(storyboard);

    return storyboard;

  } catch (error) {
    console.error('Claude API Error:', error);

    // Strategic log #2: Log detailed error information and fallback status
    console.log(`[ERROR_HANDLING] Claude error type: ${error.status || 'unknown'}, message: "${error.message || 'none'}", error_type: ${error.error?.error?.type || 'unknown'}, fallback provider: ${config.aiProvider === 'claude' ? config.fallbackProvider || 'none' : 'N/A'}`);

    // Handle specific error cases
    if (error.status === 429) {
      throw new ServiceUnavailableError('Claude API rate limit exceeded. Please try again later.');
    }

    if (error.status === 401) {
      throw new ServiceUnavailableError('Invalid Claude API key. Please check your configuration.');
    }

    // Handle overloaded error (add specific case)
    if (error.status === 529 || (error.error?.error?.type === 'overloaded_error')) {
      // Strategic error log for Claude overload errors
      console.error(`[CLAUDE_OVERLOAD_ERROR] Claude service is overloaded despite unified rate limiting:
        - Claude bucket: ${JSON.stringify(unifiedRateLimiter.buckets?.claude || {})}
        - Used configuration: maxConcurrent=${unifiedRateLimiter.buckets?.claude?.maxConcurrent || 'N/A'}, 
          tokensPerMinute=${unifiedRateLimiter.buckets?.claude?.maxTokens || 'N/A'},
          tokensPerRequest=${unifiedRateLimiter.buckets?.claude?.tokensPerRequest || 'N/A'}
        - Request size: ~${numScenes || 'default'} scenes, ~${prompt?.length || 0} chars in prompt
        This appears to be a Claude service capacity issue - our rate limiting is correctly configured
        but Claude is still reporting overload.`);
      
      throw new ServiceUnavailableError(`Failed to generate storyboard with Claude: API overloaded. Please try again later or switch to another AI provider.`);
    }

    // Re-throw the error if it's already a ServiceUnavailableError
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(`Failed to generate storyboard with Claude: ${error.message}`);
  }
};

/**
 * Generate a storyboard with the configured provider
 *
 * @param {string} prompt - Movie concept prompt
 * @param {string} provider - Optional override for AI provider (openai or claude)
 * @param {number} numScenes - Optional number of scenes to generate
 * @returns {Object} Storyboard object
 */
exports.generateStoryboard = async (prompt, provider = null, numScenes = null) => {
  // Use the specified provider or fall back to configured default
  const selectedProvider = provider || config.aiProvider;
  
  // Strategic log #3: Log the selected provider and fallback configuration
  console.log(`[PROVIDER_SELECTION] Using provider: ${selectedProvider}, default provider: ${config.aiProvider}, fallback configured: ${config.fallbackProvider || 'none'}`);

  console.log(`Using ${selectedProvider} for storyboard generation`);
  console.log(`Number of scenes requested: ${numScenes ? numScenes : 'Auto'}`);

  // Call the appropriate provider-specific implementation
  switch (selectedProvider.toLowerCase()) {
    case 'openai':
      return await exports.generateStoryboardWithOpenAI(prompt, numScenes);
    case 'claude':
      return await exports.generateStoryboardWithClaude(prompt, numScenes);
    case 'gemini':
      return await exports.generateStoryboardWithGemini(prompt, numScenes);
    default:
      throw new ServiceUnavailableError(`Unknown AI provider: ${selectedProvider}`);
  }
};

/**
 * Generate a storyboard using Gemini API
 *
 * @param {string} prompt - User's storyboard request
 * @param {number} numScenes - Optional number of scenes to generate
 * @returns {object} Storyboard data including title, description, and scenes
 */
const generateStoryboardWithGemini = async (prompt, numScenes = null) => {
  if (!config.gemini.apiKey) {
    throw new ServiceUnavailableError('Gemini API key is not configured');
  }

  try {
    console.log('[Storyboard Service] Using unified rate limiter for Gemini request');

    // Get Gemini client with tracking
    const { client, completeRequest } = getGeminiClient();

    // Prepare prompts with specific storyboard generation instructions
    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(prompt, numScenes);

    // Use the unified rate limiter to make the request
    const result = await unifiedRateLimiter.executeRequest(
      async () => {
        // Call Gemini API with structured output configuration
        const response = await client.models.generateContent({
          model: config.gemini.model,
          contents: `${systemPrompt}\n\n${userPrompt}`,
          generationConfig: {
            temperature: 0.7, // Higher temperature for creative storyboards
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "A concise title for the movie"
                },
                description: {
                  type: Type.STRING,
                  description: "Overall description of the movie and its story arc"
                },
                scenes: {
                  type: Type.ARRAY,
                  description: "Sequential scenes describing different states of the animation",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: {
                        type: Type.STRING,
                        description: "Unique identifier for the scene"
                      },
                      description: {
                        type: Type.STRING,
                        description: "Detailed description of what happens in this scene"
                      },
                      svgPrompt: {
                        type: Type.STRING,
                        description: "Detailed prompt for generating an SVG animation of this scene"
                      },
                      duration: {
                        type: Type.NUMBER,
                        description: "Duration of the scene in seconds"
                      }
                    },
                    required: ["id", "description", "svgPrompt", "duration"]
                  }
                }
              },
              required: ['title', 'description', 'scenes']
            }
          }
        });
        return response;
      },
      [config.gemini.model, systemPrompt, userPrompt], // Args for caching/deduplication
      'gemini' // Provider name for rate limiting
    );

    const text = result.text;

    if (!text) {
      console.warn('Empty response from Gemini API');
      throw new ServiceUnavailableError('Received empty storyboard response from Gemini API');
    }

    try {
      // Since we're using structured output, the response should be JSON
      const parsedResponse = JSON.parse(text);

      if (!parsedResponse || !parsedResponse.title || !parsedResponse.scenes) {
        console.warn('Invalid storyboard format in Gemini response');
        throw new ServiceUnavailableError('Invalid storyboard format received from Gemini API');
      }

      console.log(`Successfully received storyboard with ${parsedResponse.scenes.length} scenes`);
      return processStoryboard(parsedResponse);
    } catch (parseError) {
      console.error('Error parsing JSON from Gemini storyboard response:', parseError);
      console.error('Raw response:', text);

      // Fall back to regex extraction if JSON parsing fails
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[0];
          const extractedResponse = JSON.parse(jsonStr);

          if (extractedResponse && extractedResponse.title && extractedResponse.scenes) {
            console.log('Successfully extracted storyboard using regex fallback');
            return processStoryboard(extractedResponse);
          }
        } catch (e) {
          console.error('Failed to extract storyboard JSON with regex fallback:', e);
        }
      }

      throw new ServiceUnavailableError('Failed to parse storyboard response from Gemini API');
    }
  } catch (error) {
    console.error('Gemini API Error in storyboard generation:', error);

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

exports.generateStoryboardWithGemini = generateStoryboardWithGemini;

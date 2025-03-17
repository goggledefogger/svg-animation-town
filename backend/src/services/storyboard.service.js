const OpenAI = require('openai');
const { ServiceUnavailableError, BadRequestError } = require('../utils/errors');
const config = require('../config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Generate a storyboard using OpenAI
 * Completely separate from SVG generation flow
 *
 * @param {string} prompt - Movie concept prompt
 * @returns {Object} Storyboard object with title, description, and scenes
 */
exports.generateStoryboardWithOpenAI = async (prompt) => {
  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  if (!config.openai.apiKey) {
    throw new ServiceUnavailableError('OpenAI API key is not configured');
  }

  try {
    // Create a dedicated system prompt just for storyboard generation
    const systemPrompt = `You are a storyboard generator for movies.
Your only job is to create a JSON storyboard based on a movie concept.
NEVER generate SVG content or code. Only generate a JSON structure.`;

    // Create a specific user prompt for storyboard generation
    const userPrompt = `Create a storyboard for this movie concept: "${prompt}"

IMPORTANT INSTRUCTIONS:
1. ONLY return valid JSON with this EXACT structure (no other text):
{
  "title": "Movie title",
  "description": "Overall description of the movie",
  "scenes": [
    {
      "id": "scene1",
      "description": "Description of the scene",
      "svgPrompt": "Prompt to generate an animation for this scene",
      "duration": 5
    }
  ]
}

2. Each scene needs those exact fields.
3. Include 3-7 scenes that tell a cohesive story.
4. For each scene's "svgPrompt", write a detailed prompt that describes what should be in that scene's animation.
5. DO NOT include any SVG code or XML tags.`;

    console.log('Sending storyboard generation request to OpenAI');
    console.log(`Using prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

    // Use the OpenAI API with JSON response format
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

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

    console.log(`Successfully generated storyboard with ${storyboard.scenes.length} scenes`);
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
 * Generate a storyboard using Claude (placeholder for now)
 *
 * @param {string} prompt - Movie concept prompt
 * @returns {Object} Storyboard object with title, description and scenes
 */
exports.generateStoryboardWithClaude = async (prompt) => {
  // This would be implemented similarly to the OpenAI version
  // For now, throw an error that Claude implementation is pending
  throw new ServiceUnavailableError('Claude storyboard generation is not yet implemented');
};

/**
 * Generate a storyboard with the configured provider
 *
 * @param {string} prompt - Movie concept prompt
 * @param {string} provider - Optional override for AI provider (openai or claude)
 * @returns {Object} Storyboard object
 */
exports.generateStoryboard = async (prompt, provider = null) => {
  // Use the specified provider or fall back to configured default
  const selectedProvider = provider || config.aiProvider;

  console.log(`Using ${selectedProvider} for storyboard generation`);

  // Call the appropriate provider-specific implementation
  switch (selectedProvider.toLowerCase()) {
    case 'openai':
      return await exports.generateStoryboardWithOpenAI(prompt);
    case 'claude':
      return await exports.generateStoryboardWithClaude(prompt);
    default:
      throw new ServiceUnavailableError(`Unknown AI provider: ${selectedProvider}`);
  }
};

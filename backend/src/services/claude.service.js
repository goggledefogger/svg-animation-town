const anthropic = require('./shared-claude-client');
const {
  getCommonInstructions,
  addExistingSvgToPrompt,
  getSvgResponseSchema,
  formatParsedResponse,
  generateErrorSvg
} = require('../utils/prompt-builder');
const { ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');
const rateLimiter = require('./unified-rate-limiter.service');
const { getMaxOutputTokens } = require('../utils/provider-utils');

// Add a unique identifier for this client instance
const clientId = Math.random().toString(36).substring(7);
console.log(`[Claude Service] Created Claude client instance ${clientId}`);

/**
 * Build Claude-specific system prompt
 *
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} Claude system prompt
 */
const buildClaudeSystemPrompt = (isUpdate = false) => {
  const baseInstructions = getCommonInstructions(isUpdate);

  return `${baseInstructions}

You are an SVG animation expert. Your ONLY task is to create or modify SVG animations.

YOU MUST RESPOND IN VALID JSON FORMAT WITH THE FOLLOWING STRUCTURE:
{
  "explanation": "Brief description of the animation",
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 800 600\" width=\"800\" height=\"600\">...</svg>"
}

SVG REQUIREMENTS:
1. The SVG field MUST start with '<svg xmlns="http://www.w3.org/2000/svg"'
2. The SVG MUST include:
   - All required namespace attributes
   - viewBox="0 0 800 600"
   - width="800" height="600"
   - <style> tag containing animations
   - All animation elements properly defined
3. The SVG MUST be a complete document that can be directly embedded in a webpage
4. The SVG MUST end with '</svg>'

FORMAT REQUIREMENTS:
1. Your response MUST be valid JSON with NO text outside the JSON object
2. Both "explanation" and "svg" fields are REQUIRED
3. Escape quotes and special characters properly in the SVG string
4. DO NOT include backticks, code blocks, or extra text outside the JSON
5. DO NOT include any explanations or notes outside the JSON object`;
};

/**
 * Build Claude-specific user prompt
 *
 * @param {string} userPrompt - User's animation request
 * @param {string} currentSvg - Current SVG content for updates
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} Claude user prompt
 */
const buildClaudeUserPrompt = (userPrompt, currentSvg = '', isUpdate = false) => {
  let content = isUpdate && currentSvg
    ? `Update this SVG animation based on this request: ${userPrompt}`
    : `Create an SVG animation based on this description: ${userPrompt}`;

  if (isUpdate && currentSvg) {
    content = addExistingSvgToPrompt(content, currentSvg);
  }

  content += `\n\nYOU MUST RESPOND WITH VALID JSON ONLY - NO TEXT OUTSIDE THE JSON:
{
  "explanation": "Brief description of what you created/modified",
  "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 800 600\\" width=\\"800\\" height=\\"600\\">...</svg>"
}

The SVG must be complete, with all required attributes and properly escaped. DO NOT include any text, explanations, or notes outside the JSON.`;

  return content;
};

/**
 * Generate a basic SVG animation based on prompt
 * This is a fallback when Claude fails to generate a valid SVG
 *
 * @param {string} prompt - The user's animation prompt
 * @param {boolean} isUpdate - Whether this is an update
 * @returns {Object} - Simple SVG response object
 */
const generateBasicSvg = (prompt, isUpdate = false) => {
  // Extract key colors and elements from the prompt
  const isBatman = prompt.toLowerCase().includes('batman');
  const batYellow = '#ffdf00';

  // Extract main colors from the prompt using common color names
  const colorMatches = prompt.match(/\b(red|blue|green|yellow|purple|orange|pink|white|black|gray|grey|cyan|magenta|brown|gold|silver)\b/gi) || [];
  const uniqueColors = [...new Set(colorMatches.map(c => c.toLowerCase()))];

  // Map color names to hex values
  const colorMap = {
    red: '#e53935',
    blue: '#1e88e5',
    green: '#43a047',
    yellow: '#fdd835',
    purple: '#8e24aa',
    orange: '#fb8c00',
    pink: '#d81b60',
    white: '#f5f5f5',
    black: '#212121',
    gray: '#757575',
    grey: '#757575',
    cyan: '#00acc1',
    magenta: '#d500f9',
    brown: '#795548',
    gold: '#ffc107',
    silver: '#bdbdbd'
  };

  // Generate a primary and secondary color
  const primaryColor = isBatman ? batYellow :
                      (uniqueColors.length > 0 ? colorMap[uniqueColors[0]] : '#1e88e5');
  const secondaryColor = uniqueColors.length > 1 ? colorMap[uniqueColors[1]] : '#f5f5f5';

  // Create a simple animated SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="800" height="600" fill="#1a1a2e" />

  <style>
    .shape {
      animation: pulse 4s infinite alternate;
    }

    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.2); opacity: 1; }
    }

    .orbit {
      animation: rotate 10s linear infinite;
      transform-origin: 400px 300px;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  </style>

  <circle cx="400" cy="300" r="100" fill="${primaryColor}" class="shape" />
  <circle cx="400" cy="150" r="30" fill="${secondaryColor}" class="orbit" />

  <text x="400" y="550" font-family="Arial" font-size="20" fill="white" text-anchor="middle">
    Animation: ${prompt.substring(0, 30)}${prompt.length > 30 ? '...' : ''}
  </text>
</svg>`;

  return {
    explanation: `Simple animated SVG ${isUpdate ? 'update' : ''} based on prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
    svg: svg
  };
};

/**
 * Process SVG generation or update with Claude
 *
 * @param {string} prompt - User's animation request
 * @param {string} currentSvg - Current SVG for updates (empty for new animations)
 * @param {boolean} isUpdate - Whether this is an update
 * @returns {string} Response with SVG content
 */
const processSvgWithClaude = async (prompt, currentSvg = '', isUpdate = false, options = {}) => {
  if (!config.anthropic.apiKey) {
    throw new ServiceUnavailableError('Claude API key is not configured');
  }

  try {
    // Build prompts with Claude-specific instructions
    const systemPrompt = buildClaudeSystemPrompt(isUpdate);
    const userPrompt = buildClaudeUserPrompt(prompt, currentSvg, isUpdate);

    console.log(`[Claude Service ${clientId}] Starting request with client instance ${clientId}`);

    // Call Claude API directly - rate limiting is handled at the AI service level
    const modelId = options.model || config.anthropic.model;

    // Handle temperature: respect null (model doesn't support it), otherwise use override or config default
    let baseTemperature;
    if (Object.prototype.hasOwnProperty.call(options, 'temperature')) {
      baseTemperature = (options.temperature === null || options.temperature === undefined)
        ? undefined
        : options.temperature;
    } else {
      baseTemperature = config.anthropic.temperature;
    }

    // Get model-specific max tokens, fallback to config default
    const modelMaxTokens = getMaxOutputTokens('anthropic', modelId);
    const maxTokens = modelMaxTokens !== null ? modelMaxTokens : config.anthropic.maxTokens;

    console.log(`[Claude Service] Using model ${modelId} with max_tokens: ${maxTokens}`);

    // Cap max_tokens at 8192 for SVG generation to avoid triggering streaming requirements
    // This is plenty for SVG animations and avoids the 10-minute timeout trigger
    const effectiveMaxTokens = Math.min(maxTokens, 8192);
    console.log(`[Claude Service] Effective max_tokens: ${effectiveMaxTokens} (capped from ${maxTokens})`);

    const requestPayload = {
      model: modelId,
      max_tokens: effectiveMaxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    };

    // Enable Extended Thinking for compatible models (Claude 3.7+ and 4.x)
    const isThinkingModel = modelId.includes('claude-3-7') ||
                            modelId.includes('claude-sonnet-4') ||
                            modelId.includes('claude-haiku-4') ||
                            modelId.includes('claude-opus-4');
    if (isThinkingModel) {
      // Use a conservative budget for SVG generation
      const thinkingBudget = 4096;
      requestPayload.thinking = {
        type: 'enabled',
        budget_tokens: thinkingBudget
      };
      console.log(`[Claude Service] Extended Thinking enabled with budget: ${thinkingBudget} tokens`);
    }

    // Only add temperature if it's a valid number (Claude models all support temperature, but be safe)
    if (typeof baseTemperature === 'number') {
      requestPayload.temperature = isUpdate ? Math.max(0.1, baseTemperature - 0.2) : baseTemperature;
    }

    const response = await anthropic.messages.create(requestPayload);

    console.log(`[Claude Service ${clientId}] Request completed`);

    // Extract the content from the response
    if (response.content && response.content.length > 0) {
      const textBlock = response.content.find(block => block.type === 'text');

      if (textBlock && textBlock.text) {
        try {
          const parsedResponse = await parseClaudeResponse(textBlock.text);
          console.log('Parsed response:', {
            hasExplanation: !!parsedResponse.explanation,
            svgLength: parsedResponse.svg?.length || 0
          });
          return parsedResponse.svg;
        } catch (parseError) {
          console.error('Failed to parse Claude response:', parseError);
          const fallback = generateBasicSvg(prompt, isUpdate);
          return fallback.svg;
        }
      }
    }

    throw new ServiceUnavailableError('Claude response missing text content');
  } catch (error) {
    console.error('Claude API Error:', error);

    if (error?.status === 429 || error?.message?.includes('rate_limit')) {
      console.log('Providing fallback SVG due to rate limiting');
      const fallback = generateBasicSvg(prompt, isUpdate);
      return fallback.svg;
    }

    throw new ServiceUnavailableError(`Claude API Error: ${error.message}`);
  }
};

/**
 * Parse Claude's response text into a valid JSON object
 * @param {string} text - Response text from Claude
 * @returns {Object} Parsed response object
 */
const parseClaudeResponse = async (text) => {
  // If the text is empty or just whitespace, generate an error
  if (!text.trim()) {
    throw new ServiceUnavailableError('Claude returned an empty response');
  }

  // Try direct JSON parsing first
  try {
    const parsedResponse = JSON.parse(text);
    console.log('Successfully parsed direct JSON response');
    return parsedResponse;
  } catch (directParseError) {
    console.log('Direct JSON parsing failed, attempting to extract JSON from text');
  }

  // Try to extract JSON using regex
  const jsonRegex = /\{(?:[^{}]|(\{(?:[^{}]|(\{(?:[^{}]|(\{[^{}]*\}))*\}))*\}))*\}/g;
  const jsonMatches = text.match(jsonRegex);

  if (jsonMatches && jsonMatches.length > 0) {
    // Try each JSON match until one parses successfully
    for (const potentialJson of jsonMatches) {
      try {
        const parsedResponse = JSON.parse(potentialJson);
        console.log('Successfully extracted JSON using regex');
        return parsedResponse;
      } catch (e) {
        // Continue to next match
      }
    }
  }

  // Check for JSON in code blocks
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const codeBlockMatch = text.match(codeBlockRegex);

  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      const parsedResponse = JSON.parse(codeBlockMatch[1].trim());
      console.log('Successfully extracted JSON from code block');
      return parsedResponse;
    } catch (codeBlockError) {
      console.error('Failed to parse JSON from code block:', codeBlockError);
    }
  }

  throw new ServiceUnavailableError('Failed to extract valid JSON from Claude response');
};

/**
 * Generate a new SVG animation based on user prompt
 *
 * @param {string} prompt - User's animation request
 * @returns {string} Claude response with SVG content
 */
exports.generateAnimation = async (prompt, options = {}) => {
  return processSvgWithClaude(prompt, '', false, options);
};

/**
 * Update an existing animation based on user prompt and previous SVG content
 *
 * @param {string} prompt - User's animation update request
 * @param {string} currentSvg - Current SVG content (if any)
 * @returns {string} Claude response with updated SVG content
 */
exports.updateAnimation = async (prompt, currentSvg = '', options = {}) => {
  return processSvgWithClaude(prompt, currentSvg, true, options);
};

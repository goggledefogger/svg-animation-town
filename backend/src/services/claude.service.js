const Anthropic = require('@anthropic-ai/sdk');
const {
  getCommonInstructions,
  addExistingSvgToPrompt,
  getSvgResponseSchema,
  formatParsedResponse,
  generateErrorSvg
} = require('../utils/prompt-builder');
const { ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');

// Rate limiter implementation for Claude API
// Using a token bucket algorithm to manage the rate limit
const rateLimiter = {
  // Bucket capacity from config (Claude's rate limit tokens per minute)
  tokenBucket: config.claude.rateLimiter.tokensPerMinute,
  // Max tokens per request from config
  tokensPerRequest: config.claude.rateLimiter.tokensPerRequest,
  // Parallel requests allowed from config
  maxConcurrentRequests: config.claude.rateLimiter.maxConcurrentRequests,
  // Ongoing requests counter
  currentRequests: 0,
  // Last refill timestamp
  lastRefillTime: Date.now(),
  // Queue for pending requests
  requestQueue: [],

  // Refill the token bucket based on elapsed time (tokens are refilled at rate of tokensPerMinute per minute)
  refillBucket() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;

    // Calculate tokens to add (proportional to elapsed time)
    const tokensToAdd = Math.floor((elapsedMs / 60000) * config.claude.rateLimiter.tokensPerMinute);

    if (tokensToAdd > 0) {
      this.tokenBucket = Math.min(config.claude.rateLimiter.tokensPerMinute, this.tokenBucket + tokensToAdd);
      this.lastRefillTime = now;
      console.log(`Rate limiter: Refilled bucket with ${tokensToAdd} tokens. Current tokens: ${this.tokenBucket}`);
    }
  },

  // Process the next request in the queue if possible
  processQueue() {
    // Process queued requests if we have capacity
    while (this.requestQueue.length > 0 &&
           this.currentRequests < this.maxConcurrentRequests &&
           this.tokenBucket >= this.tokensPerRequest) {

      const nextRequest = this.requestQueue.shift();
      this.executeRequest(nextRequest);
    }
  },

  // Execute a request with rate limiting
  executeRequest({ fn, args, resolve, reject }) {
    this.currentRequests++;
    this.tokenBucket -= this.tokensPerRequest;

    console.log(`Rate limiter: Executing request. Tokens remaining: ${this.tokenBucket}, Current requests: ${this.currentRequests}`);

    // Execute the actual request
    fn(...args)
      .then(result => {
        this.currentRequests--;
        resolve(result);
        this.processQueue(); // Check if we can process more requests
      })
      .catch(error => {
        this.currentRequests--;

        // Handle rate limit errors specifically
        if (error?.message?.includes('429') || error?.message?.includes('rate_limit')) {
          console.log('Rate limit error detected, adjusting token bucket');
          // Reset token bucket to a low value to force throttling
          this.tokenBucket = Math.min(this.tokenBucket, this.tokensPerRequest / 2);
        }

        reject(error);
        this.processQueue(); // Check if we can process more requests
      });
  },

  // Queue a request to be executed when capacity is available
  enqueueRequest(fn, args) {
    // Refill bucket before checking capacity
    this.refillBucket();

    return new Promise((resolve, reject) => {
      const request = { fn, args, resolve, reject };

      // If we have capacity, execute immediately
      if (this.currentRequests < this.maxConcurrentRequests && this.tokenBucket >= this.tokensPerRequest) {
        this.executeRequest(request);
      } else {
        // Otherwise, add to queue
        console.log(`Rate limiter: Queuing request. Current queue length: ${this.requestQueue.length}`);
        this.requestQueue.push(request);
      }
    });
  }
};

/**
 * Get an initialized Anthropic client
 *
 * @returns {Anthropic} Configured Anthropic client
 */
const getAnthropicClient = () => {
  if (!config.claude.apiKey) {
    throw new ServiceUnavailableError('Claude API key is not configured');
  }

  return new Anthropic({
    apiKey: config.claude.apiKey
  });
};

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
const processSvgWithClaude = async (prompt, currentSvg = '', isUpdate = false) => {
  // This is the actual API call function that will be rate limited
  const makeClaudeRequest = async (prompt, currentSvg, isUpdate) => {
    try {
      // Get Anthropic client
      const anthropic = getAnthropicClient();

      // Build prompts with Claude-specific instructions
      const systemPrompt = buildClaudeSystemPrompt(isUpdate);
      const userPrompt = buildClaudeUserPrompt(prompt, currentSvg, isUpdate);

      console.log(`Sending ${isUpdate ? 'update' : 'creation'} request to Claude (${config.claude.model})`);

      // Adjust temperature slightly lower for updates to improve consistency
      const temperature = isUpdate
        ? Math.max(0.1, config.claude.temperature - 0.2)
        : config.claude.temperature;

      // Call Claude API without response_format parameter
      const completion = await anthropic.messages.create({
        model: config.claude.model,
        max_tokens: config.claude.maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ],
        temperature: temperature
      });

      console.log('Claude response received');

      // Extract the content from the response
      if (completion.content && completion.content.length > 0) {
        const textBlock = completion.content.find(block => block.type === 'text');

        if (textBlock && textBlock.text) {
          // Process response text (existing code)
          // ... existing code ...

          try {
            // If the text is empty or just whitespace, generate an error
            if (!textBlock.text.trim()) {
              throw new ServiceUnavailableError('Claude returned an empty response');
            }

            // Parse the JSON response
            let parsedResponse;
            try {
              // First try direct JSON parsing
              parsedResponse = JSON.parse(textBlock.text);
              console.log('Successfully parsed direct JSON response');
            } catch (directParseError) {
              console.log('Direct JSON parsing failed, attempting to extract JSON from text');

              // Try to extract JSON using regex
              const jsonRegex = /\{(?:[^{}]|(\{(?:[^{}]|(\{(?:[^{}]|(\{[^{}]*\}))*\}))*\}))*\}/g;
              const jsonMatches = textBlock.text.match(jsonRegex);

              if (jsonMatches && jsonMatches.length > 0) {
                try {
                  // Try each JSON match until one parses successfully
                  for (const potentialJson of jsonMatches) {
                    try {
                      parsedResponse = JSON.parse(potentialJson);
                      console.log('Successfully extracted JSON using regex');
                      break;
                    } catch (e) {
                      // Continue to next match
                    }
                  }
                } catch (extractionError) {
                  console.error('Failed to extract valid JSON:', extractionError);
                }
              }

              // If we still don't have a valid parsed response, check for JSON in code blocks
              if (!parsedResponse) {
                const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
                const codeBlockMatch = textBlock.text.match(codeBlockRegex);

                if (codeBlockMatch && codeBlockMatch[1]) {
                  try {
                    parsedResponse = JSON.parse(codeBlockMatch[1]);
                    console.log('Successfully extracted JSON from code block');
                  } catch (codeBlockError) {
                    console.error('Failed to parse JSON from code block:', codeBlockError);
                  }
                }
              }

              // If all extraction methods failed, throw the original error
              if (!parsedResponse) {
                console.error('All JSON extraction methods failed');
                throw new ServiceUnavailableError('Claude did not return a valid JSON response');
              }
            }

            // Validate the required fields
            if (!parsedResponse.svg) {
              throw new ServiceUnavailableError('SVG field is missing from the response');
            }

            const svgContent = parsedResponse.svg;

            if (!svgContent.trim().startsWith('<svg')) {
              throw new ServiceUnavailableError('Invalid SVG: Must start with <svg> tag');
            }

            if (!svgContent.includes('xmlns="http://www.w3.org/2000/svg"')) {
              throw new ServiceUnavailableError('Invalid SVG: Missing required xmlns attribute');
            }

            if (!svgContent.includes('viewBox="0 0 800 600"')) {
              throw new ServiceUnavailableError('Invalid SVG: Missing or incorrect viewBox');
            }

            if (!svgContent.includes('<style>')) {
              throw new ServiceUnavailableError('Invalid SVG: Missing style tag for animations');
            }

            console.log('SVG validation passed, returning response');
            return formatParsedResponse(parsedResponse);
          } catch (parseError) {
            console.error('Failed to parse Claude response as JSON:', parseError);
            throw new ServiceUnavailableError('Claude did not return a valid JSON response');
          }
        }

        throw new ServiceUnavailableError('Claude response missing text content');
      }

      throw new ServiceUnavailableError('Claude response contains no content');
    } catch (error) {
      console.error('Claude API Error:', error);
      throw new ServiceUnavailableError(`Claude API Error: ${error.message || 'Unknown error'}`);
    }
  };

  // Use the rate limiter to control API request flow
  try {
    return await rateLimiter.enqueueRequest(makeClaudeRequest, [prompt, currentSvg, isUpdate]);
  } catch (error) {
    console.error('Rate limited Claude request failed:', error);

    // If we get rate limit errors despite our limiter, provide a basic SVG fallback
    if (error?.message?.includes('429') || error?.message?.includes('rate_limit')) {
      console.log('Providing fallback SVG due to rate limiting');
      return formatParsedResponse(generateBasicSvg(prompt, isUpdate));
    }

    throw error;
  }
};

/**
 * Generate a new SVG animation based on user prompt
 *
 * @param {string} prompt - User's animation request
 * @returns {string} Claude response with SVG content
 */
exports.generateAnimation = async (prompt) => {
  return processSvgWithClaude(prompt, '', false);
};

/**
 * Update an existing animation based on user prompt and previous SVG content
 *
 * @param {string} prompt - User's animation update request
 * @param {string} currentSvg - Current SVG content (if any)
 * @returns {string} Claude response with updated SVG content
 */
exports.updateAnimation = async (prompt, currentSvg = '') => {
  return processSvgWithClaude(prompt, currentSvg, true);
};

/**
 * Get current status of the rate limiter for debugging
 *
 * @returns {Object} Current state of the rate limiter
 */
exports.getRateLimiterStatus = () => {
  return {
    tokenBucket: rateLimiter.tokenBucket,
    tokensPerRequest: rateLimiter.tokensPerRequest,
    maxConcurrentRequests: rateLimiter.maxConcurrentRequests,
    currentRequests: rateLimiter.currentRequests,
    requestQueue: rateLimiter.requestQueue.length,
    lastRefillTime: rateLimiter.lastRefillTime
  };
};

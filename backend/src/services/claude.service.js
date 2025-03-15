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

You MUST use the provided tool for your response.

Follow these instructions carefully:
1. Your response should only use the provided tool, not regular text output.
2. The 'explanation' field must contain a brief description of what you created or modified.
3. The 'svg' field must contain the complete SVG code as a valid string, properly escaped.
4. The SVG code must include all required elements (xmlns, viewBox, dimensions).
5. Check that your SVG is properly formatted before submitting.

Both fields are REQUIRED. Omitting either will result in an error.`;
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
  let content = '';

  if (isUpdate && currentSvg) {
    content = `Update this SVG animation based on this request: ${userPrompt}`;
    content = addExistingSvgToPrompt(content, currentSvg);
  } else {
    content = `Create an SVG animation based on this description: ${userPrompt}`;
  }

  // Add a reminder about using the tool properly
  content += "\n\nIMPORTANT: You must use the provided tool to return your response, ensuring both 'explanation' and 'svg' fields are included. The 'svg' field must contain a complete, valid SVG document with proper XML structure.";

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

    // Define the tool for SVG creation/updates
    const toolName = isUpdate ? "update_svg_animation" : "create_svg_animation";
    const toolDescription = isUpdate
      ? "Creates an updated SVG animation based on the user's request and existing SVG. Always returns both explanation and svg fields."
      : "Creates a new SVG animation based on the user's description. Always returns both explanation and svg fields.";

    // Custom schema with more detailed descriptions
    const toolSchema = {
      type: "object",
      properties: {
        explanation: {
          type: "string",
          description: "A brief explanation of what you created or modified in the SVG animation"
        },
        svg: {
          type: "string",
          description: "The complete SVG code as a valid string. Must include all required SVG elements, namespaces, and be properly escaped."
        }
      },
      required: ["explanation", "svg"]
    };

    // Call Claude API with structured tool use for proper JSON responses
    const completion = await anthropic.messages.create({
      model: config.claude.model,
      max_tokens: config.claude.maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: temperature,
      tools: [
        {
          name: toolName,
          description: toolDescription,
          input_schema: toolSchema
        }
      ],
      tool_choice: {
        type: "tool",
        name: toolName
      }
    });

    // For debugging
    console.log('Claude response structure:', JSON.stringify({
      contentTypes: completion.content.map(c => c.type),
      hasToolUse: completion.content.some(c => c.type === 'tool_use')
    }));

    // Extract the tool use response
    if (completion.content && completion.content.length > 0) {
      // Find the tool_use block
      const toolUseBlock = completion.content.find(block =>
        block.type === 'tool_use' &&
        block.name === toolName
      );

      if (toolUseBlock && toolUseBlock.input) {
        console.log(`Successfully received structured SVG ${isUpdate ? 'update' : ''} response via tool_use`);
        console.log('Tool use input:', JSON.stringify(toolUseBlock.input));

        // Validate that we have the required fields before processing
        if (toolUseBlock.input.svg) {
          return formatParsedResponse(toolUseBlock.input);
        } else {
          console.warn('Tool use response is missing SVG field');
        }
      }

      // If we couldn't find a proper tool use response, check for text content
      const textBlock = completion.content.find(block => block.type === 'text');
      if (textBlock && textBlock.text) {
        console.log('Processing LLM response');
        const text = textBlock.text.trim();

        // First try to parse it as JSON
        try {
          const parsedJson = JSON.parse(text);
          if (parsedJson && parsedJson.svg) {
            console.log('Found valid JSON with SVG in text response');
            return formatParsedResponse(parsedJson);
          }
        } catch (e) {
          console.log('Text is not valid JSON, trying other extraction methods');
        }

        // Try to extract JSON from code blocks
        try {
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (jsonMatch && jsonMatch[1]) {
            const parsedCodeBlock = JSON.parse(jsonMatch[1].trim());
            if (parsedCodeBlock && parsedCodeBlock.svg) {
              console.log('Found JSON in code block with SVG');
              return formatParsedResponse(parsedCodeBlock);
            }
          }
        } catch (e) {
          console.log('Failed to extract JSON from code blocks');
        }

        // Direct SVG extraction as a last resort
        console.log('Falling back to direct SVG extraction');
        const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i);
        if (svgMatch && svgMatch[0]) {
          const svgContent = svgMatch[0];
          console.log(`Found SVG via direct extraction, length: ${svgContent.length}`);

          // Create a simple explanation based on the remaining text
          const textBeforeSvg = text.substring(0, text.indexOf(svgContent)).trim();
          const explanation = textBeforeSvg || `Generated SVG based on: ${prompt.substring(0, 50)}...`;

          console.log(`Extracted SVG length: ${svgContent.length}, Text length: ${explanation.length}`);

          // Construct a proper response
          const response = {
            explanation: explanation,
            svg: svgContent
          };

          return formatParsedResponse(response);
        }
      }
    }

    console.warn(`Could not extract structured SVG ${isUpdate ? 'update' : ''} response, generating fallback SVG`);

    // If we got here, Claude failed to provide a valid SVG, so generate a simple one
    if (isUpdate && currentSvg) {
      // For updates, return the original SVG with an error message
      return generateErrorSvg(
        `Could not update SVG animation as requested`,
        currentSvg
      );
    } else {
      // For new animations, create a basic animated SVG as fallback
      const fallbackSvg = generateBasicSvg(prompt, isUpdate);
      return formatParsedResponse(fallbackSvg);
    }
  } catch (error) {
    console.error('Claude API Error:', error);
    throw new ServiceUnavailableError(`Claude API Error: ${error.message || 'Unknown error'}`);
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

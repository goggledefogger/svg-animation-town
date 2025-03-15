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
  return getCommonInstructions(isUpdate);
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

  return content;
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
      ? "Updates an SVG animation based on a description and previous SVG"
      : "Creates an SVG animation based on a description";

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
          input_schema: getSvgResponseSchema()
        }
      ],
      tool_choice: {
        type: "tool",
        name: toolName
      }
    });

    // Extract the tool use response
    if (completion.content && completion.content.length > 0) {
      // Find the tool_use block
      const toolUseBlock = completion.content.find(block =>
        block.type === 'tool_use' &&
        block.name === toolName
      );

      if (toolUseBlock && toolUseBlock.input) {
        console.log(`Successfully received structured SVG ${isUpdate ? 'update' : ''} response via tool_use`);
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
        console.log('No tool_use response found, checking text content');
        try {
          // Try to extract JSON from the text content
          const jsonMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, textBlock.text];
          if (jsonMatch && jsonMatch[1]) {
            const parsedJson = JSON.parse(jsonMatch[1].trim());
            if (parsedJson && parsedJson.svg) {
              console.log('Found SVG in text response');
              return formatParsedResponse(parsedJson);
            }
          }
        } catch (e) {
          console.error('Failed to parse JSON from text content:', e);
        }
      }
    }

    console.warn(`Could not extract structured SVG ${isUpdate ? 'update' : ''} response`);
    return generateErrorSvg(
      `Could not generate ${isUpdate ? 'updated' : 'new'} SVG animation`,
      isUpdate ? currentSvg : null
    );
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

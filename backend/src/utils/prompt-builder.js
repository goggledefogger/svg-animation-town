/**
 * Common instructions for creating SVG animations
 * Used by both OpenAI and Claude
 *
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} Common instructions
 */
exports.getCommonInstructions = (isUpdate = false) => {
  return `You are an AI assistant that creates SVG animations based on user requests.

Your task is to create complete, self-contained SVG animations that include:
- Native SVG animation methods (SMIL or CSS)
- Embedded styles within the SVG (inside <style> tags)
- Proper SVG namespaces
- A viewBox of "0 0 800 600" and appropriate dimensions
- Target a dark background (the container has a black background)

${isUpdate ? 'Modify the existing SVG to incorporate the requested changes while preserving the overall structure.' : 'Create a completely new animation based on the user request.'}

CRITICAL POSITIONING REQUIREMENTS:
- Always position main elements at the center of the canvas (400, 300)
- When using groups (<g>), either:
  - Use transform="translate(400, 300)" for the group AND keep inner elements centered at (0,0)
  - OR position each element directly at the center coordinates (cx="400" cy="300")
- NEVER combine relative positioning (local coordinates) with incorrect group transforms
- INCORRECT: <g transform="translate(350, 300)"><circle cx="0" cy="0" r="50"/></g> (off-center)
- CORRECT: <g transform="translate(400, 300)"><circle cx="0" cy="0" r="50"/></g> (centered)
- ALSO CORRECT: <circle cx="400" cy="300" r="50"/> (centered without groups)
- If animations move elements, ensure they start from the center position

Example SVG template:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <!-- Place gradients, filters here -->
  </defs>

  <style>
    /* Place CSS animations here */
    @keyframes example {
      0% { transform: translateX(0); }
      100% { transform: translateX(100px); }
    }
  </style>

  <!-- Center all main elements at (400, 300) -->
</svg>

Creative guidance:
- You have full creative freedom in designing the animation
- Use descriptive IDs for SVG elements
- You can use both CSS animations or SMIL animations based on which works better
- Always include the bat-yellow color (#ffdf00) for Batman-themed animations
- ALWAYS verify your elements are positioned at the center (400, 300) before finalizing`;
};

/**
 * Add existing SVG to a prompt for updates
 * Common functionality for both AI providers
 *
 * @param {string} userPrompt - The basic user prompt
 * @param {string} currentSvg - The current SVG to update
 * @returns {string} - The prompt with SVG added
 */
exports.addExistingSvgToPrompt = (userPrompt, currentSvg) => {
  return `${userPrompt}

Here is the current SVG animation:

${currentSvg}`;
};

/**
 * Get common JSON response structure information
 * Used in prompts for both providers
 *
 * @returns {string} - Description of the JSON response structure
 */
exports.getJsonResponseStructure = () => {
  return `Your response must be formatted as valid JSON with two fields:
1. "explanation": A brief description of what you created or updated
2. "svg": The complete SVG code as a string (with all necessary attributes and animations)`;
};

/**
 * Format a parsed response consistently across providers
 *
 * @param {Object} parsedResponse - The parsed JSON response from the AI
 * @returns {string|null} - Formatted response for the controller
 */
exports.formatParsedResponse = (parsedResponse) => {
  if (!parsedResponse || !parsedResponse.svg) {
    return null;
  }

  // Return as a formatted string to match the original implementation
  // This is likely what the controller expects
  return `${parsedResponse.explanation || ''}\n\n${parsedResponse.svg}`;
};

/**
 * Get JSON schema for SVG response
 * Used for structured tool use with Claude
 *
 * @returns {Object} - The JSON schema for SVG response
 */
exports.getSvgResponseSchema = () => {
  return {
    type: "object",
    properties: {
      explanation: {
        type: "string",
        description: "Explanation of what was created or modified in the SVG"
      },
      svg: {
        type: "string",
        description: "Complete SVG code with animations"
      }
    },
    required: ["explanation", "svg"]
  };
};

/**
 * Generate a fallback error SVG
 *
 * @param {string} message - Error message to display
 * @param {string} currentSvg - The current SVG (for updates)
 * @returns {string} - Error response as a string
 */
exports.generateErrorSvg = (message = "Could not generate SVG animation", currentSvg = null) => {
  const explanation = `Error: ${message}`;

  if (currentSvg) {
    return `${explanation}\n\n${currentSvg}`;
  }

  const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#1a1a2e" />
    <text x="400" y="280" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
      ${message}
    </text>
    <text x="400" y="320" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle">
      Try again with a different prompt
    </text>
  </svg>`;

  return `${explanation}\n\n${errorSvg}`;
};

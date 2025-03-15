/**
 * Build the system prompt for the OpenAI API
 * Optimized for use with gpt-4o-mini model
 * Instructs the model to create complete SVG animations
 *
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} System prompt
 */
exports.buildSystemPrompt = (isUpdate = false) => {
  return `You are an AI assistant that creates SVG animations based on user requests.
Your responses should include:
1. A brief explanation of what you're creating
2. A complete, self-contained SVG that includes all animation directly within it.

The SVG must:
- Include all animations using native SVG animation methods (SMIL or CSS)
- Have all styles and animations embedded within the SVG (inside <style> tags)
- Be complete and ready to display without any additional processing
- Use proper SVG namespaces
- Set a viewBox of "0 0 800 600" and appropriate dimensions
- Target a dark background (the container has a black background)

Here's an example of how your SVG could be structured:

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <!-- Definitions for gradients, filters, etc. -->
  <defs>
    <linearGradient id="myGradient" gradientTransform="rotate(90)">
      <stop offset="5%" stop-color="gold" />
      <stop offset="95%" stop-color="red" />
    </linearGradient>
  </defs>
  
  <!-- Embedded CSS animations -->
  <style>
    @keyframes move {
      0% { transform: translateX(0); }
      100% { transform: translateX(300px); }
    }
    #animated-element {
      animation: move 3s ease infinite alternate;
    }
  </style>
  
  <!-- SVG elements -->
  <circle id="animated-element" cx="50" cy="50" r="20" fill="url(#myGradient)" />
  
  <!-- SMIL animations can also be used -->
  <rect x="50" y="100" width="50" height="50" fill="blue">
    <animate 
      attributeName="x" 
      values="50;350;50" 
      dur="4s" 
      repeatCount="indefinite" 
      begin="0s" />
  </rect>
</svg>

You have full creative freedom in designing the animation. Use descriptive IDs for SVG elements.
${isUpdate ? 'Modify the existing SVG to incorporate the requested changes while preserving the overall structure.' : 'Create a completely new animation based on the user request.'}
You can use both CSS animations (in style tags) or SMIL animations (<animate> tags) based on which works better for the specific animation.
Make sure all your SVG is valid and will render correctly in modern browsers.
Always include the bat-yellow color (#ffdf00) for Batman-themed animations and important highlights.`;
};

/**
 * Build the user prompt for the OpenAI API
 * For use with GPT-4o-mini model
 *
 * @param {string} userPrompt - User's request
 * @param {string} currentSvg - Current SVG content (if any)
 * @param {boolean} isUpdate - Whether this is an update to an existing animation
 * @returns {string} User prompt
 */
exports.buildUserPrompt = (userPrompt, currentSvg = '', isUpdate = false) => {
  let prompt = userPrompt;

  // If there is current SVG content and this is an update, include it in the prompt
  if (currentSvg && isUpdate) {
    prompt += `\n\nHere is the current SVG animation:\n\n${currentSvg}`;
    prompt += "\n\nPlease modify this SVG animation according to my request while preserving the overall structure.";
  }

  prompt += "\n\nMake sure to respond with a complete, self-contained SVG that can be directly inserted into the webpage.";

  return prompt;
};

const { v4: uuidv4 } = require('uuid');

/**
 * Extract SVG code and explanatory text from the LLM response
 * Handles both structured (JSON) and unstructured (raw text) formats
 *
 * @param {string} responseText - The raw response from the LLM
 * @returns {Object} - Object containing the SVG code and explanatory text
 */
exports.extractSvgAndText = (responseText) => {
  try {
    // Early return for empty responses
    if (!responseText || responseText.trim() === '') {
      console.warn('Empty response received');
      return {
        svg: createErrorSvg('Empty response received'),
        text: 'Sorry, the AI returned an empty response. Please try again.'
      };
    }

    // First try to parse as JSON (for structured responses)
    try {
      // Check if the response is JSON
      if (responseText.trim().startsWith('{') && responseText.trim().endsWith('}')) {
        const parsedResponse = JSON.parse(responseText);

        // Check if it has the expected structure
        if (parsedResponse.svg && typeof parsedResponse.svg === 'string') {
          return {
            svg: parsedResponse.svg,
            text: parsedResponse.explanation || 'Animation created successfully!'
          };
        }
      }
    } catch (jsonError) {
      // Not a valid JSON or doesn't have the expected structure
    }

    // If not a valid JSON, try the direct SVG extraction
    let svg = '';
    let text = responseText;

    // Extract SVG tag
    const svgMatch = responseText.match(/<svg[\s\S]*?<\/svg>/);
    if (svgMatch) {
      svg = svgMatch[0];
      // Get the text content by removing the SVG
      text = responseText.replace(svg, '').trim();
    } else {
      // If no direct match, check for code blocks
      const codeBlockMatch = responseText.match(/```(?:svg|html|xml)?\s*([\s\S]*?)```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        const content = codeBlockMatch[1].trim();
        const svgInBlock = content.match(/<svg[\s\S]*?<\/svg>/);

        if (svgInBlock) {
          svg = svgInBlock[0];
          text = responseText.replace(codeBlockMatch[0], '').trim();
        }
      }
    }

    // Clean up text
    text = text.replace(/```[\s\S]*?```/g, '').trim();
    text = text.replace(/\n{3,}/g, '\n\n').trim();

    if (!svg) {
      console.warn('No SVG found in response');
      return {
        svg: createErrorSvg('No SVG found in response'),
        text: 'Sorry, I had trouble creating that animation. Please try again with a different description.'
      };
    }

    // Check for essential attributes
    if (!svg.includes('viewBox') || !svg.includes('xmlns')) {
      svg = addMissingAttributes(svg);
    }

    return { svg, text };
  } catch (error) {
    console.error('Error parsing LLM response:', error);
    return {
      svg: createErrorSvg(`Error parsing SVG: ${error.message}`),
      text: 'Sorry, there was an error processing the animation.'
    };
  }
};

/**
 * Add missing required attributes to an SVG
 *
 * @param {string} svg - The SVG string to fix
 * @returns {string} - The fixed SVG string
 */
function addMissingAttributes(svg) {
  let result = svg;

  // Add xmlns if missing
  if (!svg.includes('xmlns=')) {
    result = result.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Add viewBox if missing
  if (!svg.includes('viewBox=')) {
    result = result.replace('<svg', '<svg viewBox="0 0 800 600"');
  }

  // Add width and height if missing
  if (!svg.includes('width=')) {
    result = result.replace('<svg', '<svg width="800"');
  }

  if (!svg.includes('height=')) {
    result = result.replace('<svg', '<svg height="600"');
  }

  return result;
}

/**
 * Create a simple error SVG to display when there's a problem
 *
 * @param {string} errorMessage - The error message to display
 * @returns {string} - SVG code for an error indicator
 */
function createErrorSvg(errorMessage) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#1a1a2e" />
    <circle cx="400" cy="250" r="60" fill="#ff4040" />
    <rect x="390" y="200" width="20" height="60" fill="white" />
    <circle cx="400" cy="290" r="10" fill="white" />
    <text x="400" y="400" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
      Animation Error
    </text>
    <text x="400" y="440" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle">
      ${errorMessage}
    </text>
  </svg>`;
}

/**
 * Parse the OpenAI response to get SVG elements
 *
 * @param {string} jsonString - OpenAI response as JSON string
 * @returns {Array} Array of SVG elements
 */
exports.parseOpenAIResponse = (jsonString) => {
  try {
    // Parse the JSON string
    const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;

    if (!data || !data.elements || !Array.isArray(data.elements)) {
      throw new Error('Invalid response format: missing elements array');
    }

    // Validate and sanitize each element
    const sanitizedElements = data.elements.map(element => sanitizeElement(element));

    return {
      elements: sanitizedElements,
      message: data.message || 'Animation created successfully!'
    };
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    throw new Error(`Failed to parse OpenAI response: ${error.message}`);
  }
};

/**
 * Sanitize and validate an SVG element
 *
 * @param {Object} element - SVG element to sanitize
 * @returns {Object} Sanitized element
 */
const sanitizeElement = (element) => {
  // Ensure the element has required properties
  if (!element.type) {
    throw new Error('Element missing required property: type');
  }

  // Ensure the element has a valid type
  const validTypes = ['circle', 'rect', 'path', 'text', 'line', 'group'];
  if (!validTypes.includes(element.type)) {
    throw new Error(`Invalid element type: ${element.type}`);
  }

  // Ensure the element has required attributes based on its type
  validateRequiredAttributes(element);

  // Generate an ID if not provided
  const id = element.id || uuidv4();

  // Sanitize animations
  const animations = Array.isArray(element.animations)
    ? element.animations.map(sanitizeAnimation)
    : [];

  return {
    id,
    type: element.type,
    attributes: element.attributes || {},
    animations
  };
};

/**
 * Validate that an element has the required attributes for its type
 *
 * @param {Object} element - SVG element to validate
 */
const validateRequiredAttributes = (element) => {
  if (!element.attributes) {
    throw new Error(`Element of type ${element.type} missing attributes`);
  }

  const requiredAttributes = {
    circle: ['cx', 'cy', 'r', 'fill'],
    rect: ['x', 'y', 'width', 'height', 'fill'],
    path: ['d', 'fill'],
    text: ['x', 'y', 'font-size', 'fill'],
    line: ['x1', 'y1', 'x2', 'y2', 'stroke'],
    group: [] // No required attributes for groups
  };

  const missingAttributes = requiredAttributes[element.type].filter(
    attr => !Object.prototype.hasOwnProperty.call(element.attributes, attr)
  );

  if (missingAttributes.length > 0) {
    throw new Error(`Element of type ${element.type} missing required attributes: ${missingAttributes.join(', ')}`);
  }
};

/**
 * Sanitize and validate an animation
 *
 * @param {Object} animation - Animation to sanitize
 * @returns {Object} Sanitized animation
 */
const sanitizeAnimation = (animation) => {
  // Check for required properties
  if (!animation.targetProperty) {
    throw new Error('Animation missing required property: targetProperty');
  }

  if (!animation.keyframes || !Array.isArray(animation.keyframes) || animation.keyframes.length < 2) {
    throw new Error('Animation missing or has invalid keyframes (need at least 2)');
  }

  // Validate keyframes
  animation.keyframes.forEach((keyframe, index) => {
    if (typeof keyframe.offset !== 'number' || keyframe.offset < 0 || keyframe.offset > 1) {
      throw new Error(`Keyframe ${index} has invalid offset (must be 0-1): ${keyframe.offset}`);
    }

    if (keyframe.value === undefined) {
      throw new Error(`Keyframe ${index} missing required property: value`);
    }
  });

  // Generate an ID if not provided
  const id = animation.id || uuidv4();

  // Default duration if not provided
  const duration = typeof animation.duration === 'number' && animation.duration > 0
    ? animation.duration
    : 1000;

  return {
    id,
    targetProperty: animation.targetProperty,
    keyframes: animation.keyframes,
    duration,
    easing: animation.easing || 'ease',
    delay: typeof animation.delay === 'number' ? animation.delay : 0,
    iterationCount: animation.iterationCount || 1
  };
};

const { v4: uuidv4 } = require('uuid');

/**
 * Extract SVG code and explanatory text from the LLM response
 * 
 * @param {string} responseText - The raw response from the LLM
 * @returns {Object} - Object containing the SVG code and explanatory text
 */
exports.extractSvgAndText = (responseText) => {
  try {
    console.log('Extracting SVG and text from LLM response');
    
    // Try to extract SVG tag
    const svgMatch = responseText.match(/<svg[\s\S]*?<\/svg>/);
    const svg = svgMatch ? svgMatch[0] : '';
    
    // Get the text content by removing the SVG
    let text = responseText.replace(/<svg[\s\S]*?<\/svg>/, '').trim();
    
    // Clean up text (remove markdown code blocks if present)
    text = text.replace(/```svg[\s\S]*?```/g, '');
    text = text.replace(/```xml[\s\S]*?```/g, '');
    text = text.replace(/```html[\s\S]*?```/g, '');
    text = text.replace(/```[\s\S]*?```/g, '');
    
    // Remove any excessive newlines and trim
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    
    if (!svg) {
      console.warn('No SVG found in LLM response');
      return {
        svg: createErrorSvg('No SVG found in response'),
        text: 'Sorry, I had trouble creating that animation. Please try again with a different description.'
      };
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

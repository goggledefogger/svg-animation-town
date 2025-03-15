const { v4: uuidv4 } = require('uuid');

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

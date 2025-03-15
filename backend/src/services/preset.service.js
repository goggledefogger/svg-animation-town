const path = require('path');
const fs = require('fs').promises;

// Path to presets directory
const presetsDir = path.join(__dirname, '../data/presets');

/**
 * Convert preset elements to an SVG string
 * @param {Object} preset - The preset object with elements
 * @returns {string} - SVG string representation
 */
function elementsToSvg(preset) {
  if (!preset || !preset.elements || !Array.isArray(preset.elements)) {
    return createFallbackSvg('Invalid preset format');
  }

  // Start SVG string
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">`;

  // Add each element to the SVG
  preset.elements.forEach(element => {
    // Extract attributes
    const attributes = Object.entries(element.attributes || {})
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');

    switch (element.type) {
      case 'rect':
        svg += `<rect id="${element.id}" ${attributes}></rect>`;
        break;
      case 'circle':
        svg += `<circle id="${element.id}" ${attributes}></circle>`;
        break;
      case 'path':
        svg += `<path id="${element.id}" ${attributes}></path>`;
        break;
      case 'text':
        svg += `<text id="${element.id}" ${attributes}>${element.attributes.content || ''}</text>`;
        break;
      case 'line':
        svg += `<line id="${element.id}" ${attributes}></line>`;
        break;
      case 'group':
        svg += `<g id="${element.id}" ${attributes}></g>`;
        break;
    }
  });

  // Add simple animations
  svg += `<style>
    @keyframes pulse {
      0% { opacity: 0.7; }
      50% { opacity: 1; }
      100% { opacity: 0.7; }
    }
    #lightBeam {
      animation: pulse 2s ease-in-out infinite;
    }
  </style>`;

  // Close SVG tag
  svg += `</svg>`;

  return svg;
}

/**
 * Create a fallback SVG when preset data is invalid
 * @param {string} message - Error message
 * @returns {string} - SVG fallback
 */
function createFallbackSvg(message) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#1a1a2e" />
    <circle cx="400" cy="250" r="60" fill="#ffdf00" />
    <text x="400" y="400" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
      Preset Error
    </text>
    <text x="400" y="440" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle">
      ${message}
    </text>
    <style>
      @keyframes pulse {
        0% { r: 60; }
        50% { r: 70; }
        100% { r: 60; }
      }
      circle {
        animation: pulse 2s ease-in-out infinite;
      }
    </style>
  </svg>`;
}

/**
 * Get a preset by name
 *
 * @param {string} name - Name of the preset
 * @returns {Promise<Object|null>} Preset data or null if not found
 */
exports.getPreset = async (name) => {
  try {
    // Make sure the name is sanitized to prevent path traversal
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '');
    const presetPath = path.join(presetsDir, `${sanitizedName}.json`);

    // Try to read the preset file
    const data = await fs.readFile(presetPath, 'utf8');
    const preset = JSON.parse(data);

    // Generate SVG string for backward compatibility
    // This allows the new frontend to still work with element-based presets
    if (!preset.svg && preset.elements) {
      preset.svg = elementsToSvg(preset);
    }

    return preset;
  } catch (error) {
    // If the file doesn't exist, return null
    if (error.code === 'ENOENT') {
      return null;
    }
    // For other errors, rethrow
    throw error;
  }
};

/**
 * List all available presets
 *
 * @returns {Promise<Array>} List of preset names
 */
exports.listPresets = async () => {
  try {
    const files = await fs.readdir(presetsDir);

    // Filter for JSON files and remove extension
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    // If the directory doesn't exist yet, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

/**
 * Save a preset
 *
 * @param {string} name - Name of the preset
 * @param {Object} data - Preset data
 * @returns {Promise<void>}
 */
exports.savePreset = async (name, data) => {
  try {
    // Make sure the presets directory exists
    await fs.mkdir(presetsDir, { recursive: true });

    // Sanitize the name
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, '');
    const presetPath = path.join(presetsDir, `${sanitizedName}.json`);

    // Save the preset
    await fs.writeFile(presetPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    throw error;
  }
};

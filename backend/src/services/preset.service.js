const path = require('path');
const fs = require('fs').promises;

// Path to presets directory
const presetsDir = path.join(__dirname, '../data/presets');

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
    return JSON.parse(data);
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

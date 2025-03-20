const StoryboardService = require('../services/storyboard.service');
const { asyncHandler, BadRequestError, ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');

/**
 * Generate a storyboard from a text prompt
 */
exports.generateStoryboard = asyncHandler(async (req, res) => {
  const { prompt, provider, numScenes } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  try {
    // Use the dedicated storyboard service - completely separate from SVG generation
    console.log(`Generating storyboard for prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    console.log(`Number of scenes requested: ${numScenes ? numScenes : 'Auto'}`);
    const storyboard = await StoryboardService.generateStoryboard(prompt, provider, numScenes);

    // By this point storyboard should be fully validated and ready to return
    console.log(`Successfully generated storyboard outline with ${storyboard.scenes.length} scenes`);

    return res.status(200).json({
      success: true,
      storyboard
    });
  } catch (error) {
    console.error('Error generating storyboard:', error);
    throw error; // Error handler middleware will format the response properly
  }
});

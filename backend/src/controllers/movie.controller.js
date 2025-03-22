const StoryboardService = require('../services/storyboard.service');
const { asyncHandler, BadRequestError, ServiceUnavailableError } = require('../utils/errors');
const config = require('../config');
const storageService = require('../services/storage.service');
const { v4: uuidv4 } = require('uuid');
const animationService = require('../services/animation.service');

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

/**
 * Generate a scene animation with movie context
 * This will both generate the animation and update the movie JSON file
 */
exports.generateScene = asyncHandler(async (req, res) => {
  const { prompt, provider, movieContext } = req.body;

  if (!prompt) {
    throw new BadRequestError('Prompt is required');
  }

  if (!movieContext || !movieContext.storyboardId) {
    throw new BadRequestError('Movie context with storyboardId is required');
  }

  try {
    console.log(`Generating scene animation for prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    console.log('Movie context:', movieContext);

    // 1. Generate animation using animationService
    let animationResult;
    try {
      animationResult = await animationService.generateAnimation(prompt, provider);
      
      if (!animationResult || !animationResult.svg) {
        throw new Error('Animation generation failed: No SVG content returned');
      }
      
      console.log(`Successfully generated animation for scene ${movieContext.sceneIndex + 1} with animation ID: ${animationResult.animationId || 'None'}`);
    } catch (animationError) {
      console.error('Error generating animation:', animationError);
      // Create fallback animation result with error SVG
      animationResult = {
        svg: createErrorSvg(animationError.message || 'Unknown error generating animation'),
        message: `Error: ${animationError.message || 'Unknown error'}`,
        animationId: uuidv4() // Create a placeholder ID for tracking
      };
      
      // Save the error animation
      if (animationResult.animationId) {
        await storageService.saveAnimation({
          id: animationResult.animationId,
          name: `Error Animation for Scene ${movieContext.sceneIndex + 1}`,
          svg: animationResult.svg,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 2. Create a clip ID for the new clip
    const clipId = uuidv4();
    
    // 3. Load the existing movie from storage
    let movie = await storageService.getMovie(movieContext.storyboardId);
    
    if (!movie) {
      throw new BadRequestError(`Movie with ID ${movieContext.storyboardId} not found`);
    }
    
    // Ensure dates are properly parsed
    if (movie.createdAt && typeof movie.createdAt === 'string') {
      movie.createdAt = new Date(movie.createdAt);
    }
    
    if (movie.updatedAt && typeof movie.updatedAt === 'string') {
      movie.updatedAt = new Date(movie.updatedAt);
    }
    
    if (movie.generationStatus) {
      if (movie.generationStatus.startedAt && typeof movie.generationStatus.startedAt === 'string') {
        movie.generationStatus.startedAt = new Date(movie.generationStatus.startedAt);
      }
      
      if (movie.generationStatus.completedAt && typeof movie.generationStatus.completedAt === 'string') {
        movie.generationStatus.completedAt = new Date(movie.generationStatus.completedAt);
      }
    }
    
    // 4. Create chat history for this scene
    const chatHistory = [{
      id: uuidv4(),
      sender: 'user',
      text: prompt,
      timestamp: new Date()
    }, {
      id: uuidv4(),
      sender: 'ai',
      text: animationResult.message || 'Animation created',
      timestamp: new Date()
    }];
    
    // 5. Create clip name based on scene index and context
    const sceneName = `Scene ${movieContext.sceneIndex + 1}${movieContext.sceneDescription ? ': ' + movieContext.sceneDescription : ''}`;
    
    // 6. Create a new clip
    const newClip = {
      id: clipId,
      name: sceneName,
      svgContent: animationResult.svg,
      duration: movieContext.sceneDuration || 5,
      order: movieContext.sceneIndex,
      prompt: prompt,
      chatHistory: chatHistory,
      createdAt: new Date(),
      animationId: animationResult.animationId,
      provider: provider
    };
    
    // 7. Add the clip to the movie's clips array
    if (!movie.clips) {
      movie.clips = [];
    }
    
    // Check if a clip with this order already exists
    const existingClipIndex = movie.clips.findIndex(clip => clip.order === movieContext.sceneIndex);
    
    if (existingClipIndex >= 0) {
      // Replace existing clip
      movie.clips[existingClipIndex] = newClip;
      console.log(`Replaced existing clip at index ${existingClipIndex} (order: ${movieContext.sceneIndex})`);
    } else {
      // Add new clip
      movie.clips.push(newClip);
      console.log(`Added new clip with order ${movieContext.sceneIndex}`);
    }
    
    // Sort clips by order for consistency
    movie.clips.sort((a, b) => a.order - b.order);
    
    // 8. Update the movie's generation status
    if (!movie.generationStatus) {
      movie.generationStatus = {
        inProgress: true,
        startedAt: new Date(),
        totalScenes: movieContext.sceneCount,
        completedScenes: 0
      };
    } else {
      // If the movie already has a generation status, preserve the original total scene count
      // This ensures we maintain "7/7" instead of "7/1" when resuming
      const totalScenes = Math.max(movie.generationStatus.totalScenes || 0, movieContext.sceneCount);
      movie.generationStatus.totalScenes = totalScenes;
    }
    
    // Update completion count based on the number of clips we have after this addition
    // This ensures we count actual generated clips, not just the highest scene index
    movie.generationStatus.completedScenes = movie.clips.length;
    
    console.log(`Updated generation status: completed ${movie.generationStatus.completedScenes}/${movie.generationStatus.totalScenes} scenes`);
    
    // If we've generated all scenes, mark as complete
    if (movie.generationStatus.completedScenes >= movie.generationStatus.totalScenes) {
      movie.generationStatus.inProgress = false;
      movie.generationStatus.completedAt = new Date();
      console.log('All scenes completed, marked generation as complete');
    }
    
    // 9. Update the movie's timestamps
    movie.updatedAt = new Date();
    
    // 10. Save the updated movie
    const savedMovieId = await storageService.saveMovie(movie);
    console.log(`Saved updated movie with ID ${savedMovieId}, now has ${movie.clips.length} clips`);
    
    // 11. Return the animation with status information
    return res.status(200).json({
      success: true,
      svg: animationResult.svg,
      message: animationResult.message,
      animationId: animationResult.animationId,
      movieUpdateStatus: {
        storyboardId: movieContext.storyboardId,
        clipId: clipId,
        sceneIndex: movieContext.sceneIndex,
        completedScenes: movie.generationStatus.completedScenes,
        totalScenes: movie.generationStatus.totalScenes,
        inProgress: movie.generationStatus.inProgress
      }
    });
  } catch (error) {
    console.error('Error generating scene with movie context:', error);
    throw error;
  }
});

/**
 * Create an error SVG for fallback animation
 * @param {string} errorMessage - Error message to display
 * @returns {string} SVG content
 */
function createErrorSvg(errorMessage) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#1a1a2e" />
    <circle cx="400" cy="200" r="50" fill="#e63946" />
    <text x="400" y="320" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
      Error Generating Animation
    </text>
    <text x="400" y="360" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle" width="700">
      ${errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </text>
    <text x="400" y="400" font-family="Arial" font-size="14" fill="#999999" text-anchor="middle">
      Please try again with a different prompt
    </text>
  </svg>`;
}

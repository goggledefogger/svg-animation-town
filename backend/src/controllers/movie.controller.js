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
    // Log provider information for debugging provider-specific issues
    console.log(`Using animation provider: ${provider || config.aiProvider}`);

    // 3. Load the existing movie from storage before starting animation generation
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

    // 1. Generate animation using animationService
    let animationResult;
    try {
      animationResult = await animationService.generateAnimation(prompt, provider);

      if (!animationResult || !animationResult.svg) {
        throw new Error('Animation generation failed: No SVG content returned');
      }

      // Add more detailed logging for provider-specific debugging
      console.log(`Successfully generated animation for scene ${movieContext.sceneIndex + 1} with animation ID: ${animationResult.animationId || 'None'}`);
      console.log(`Animation provider: ${provider || config.aiProvider}, SVG content length: ${animationResult.svg.length}`);

      // Explicitly validate that we have a valid animationId for tracking
      if (!animationResult.animationId) {
        console.warn(`WARNING: Generated animation has no animationId. Provider: ${provider || config.aiProvider}`);
        // Generate a fallback ID to ensure tracking works
        animationResult.animationId = uuidv4();
        console.log(`Created fallback animation ID: ${animationResult.animationId}`);

        // Save the animation with the new ID
        await storageService.saveAnimation({
          id: animationResult.animationId,
          name: `Generated Animation for Scene ${movieContext.sceneIndex + 1}`,
          svg: animationResult.svg,
          timestamp: new Date().toISOString(),
          provider: provider || config.aiProvider
        });
      }
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
          timestamp: new Date().toISOString(),
          provider: provider || config.aiProvider,
          error: animationError.message
        });
      }
    }

    // 2. Create a clip ID for the new clip
    const clipId = uuidv4();

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

    // 6. Create a new clip object with the generated animation
    // Ensure critical fields are present, including animationId
    const newClip = {
      id: clipId,
      name: sceneName,
      svgContent: animationResult.svg,
      duration: movieContext.sceneDuration || 3000,
      order: movieContext.sceneIndex,
      prompt: prompt,
      chatHistory: chatHistory,
      animationId: animationResult.animationId, // Ensure animation ID is preserved
      createdAt: new Date(),
      provider: provider || config.aiProvider
    };

    // Log new clip details to verify animation ID is set
    console.log(`[CLIP_CREATION] Created clip: id=${newClip.id}, order=${newClip.order}, animationId=${newClip.animationId || 'MISSING!'}`);

    // 7. Initialize movie clips array if not exists
    if (!movie.clips) {
      movie.clips = [];
    }

    // 8. Add or replace the clip at the correct position
    // Find the index of the existing clip with the same order
    const existingClipIndex = movie.clips.findIndex(clip => clip.order === movieContext.sceneIndex);

    if (existingClipIndex !== -1) {
      console.log(`Replacing existing clip at index ${existingClipIndex} for order ${movieContext.sceneIndex}`);
      movie.clips[existingClipIndex] = newClip;
    } else {
      console.log(`Adding new clip for order ${movieContext.sceneIndex}`);
      movie.clips.push(newClip);
    }

    // 9. Update movie timestamps
    movie.updatedAt = new Date();

    // 10. Save the updated movie
    // Check for race conditions by reading latest movie data before saving
    const currentMovie = await storageService.getMovie(movieContext.storyboardId);
    if (currentMovie && currentMovie.clips && currentMovie.clips.length > 0) {
      // Another request may have added more clips since we loaded the movie
      console.log(`[CLIP_LINKING] Race check - Movie has ${currentMovie.clips.length} clips in storage vs ${movie.clips.length} in memory`);

      // Track which clip orders we already have
      const existingOrders = new Set(movie.clips.map(clip => clip.order));

      // Find clips that exist in currentMovie but not in our local movie object
      const missingClips = currentMovie.clips.filter(clip => !existingOrders.has(clip.order));

      // Add the missing clips if needed
      if (missingClips.length > 0) {
        console.log(`[CLIP_LINKING] Adding ${missingClips.length} missing clips to our movie before saving`);

        // Add missing clips to our array
        movie.clips = [...movie.clips, ...missingClips];

        // Sort clips by order for consistency
        movie.clips.sort((a, b) => a.order - b.order);
      }

      // Find instances where the same order has different animationIds in current vs stored movie
      // This handles the case where animations were generated while the tab was closed
      movie.clips.forEach(clip => {
        if (!clip.animationId) {
          // Look for a clip with the same order in the current movie that has an animationId
          const storedClip = currentMovie.clips.find(c => c.order === clip.order && c.animationId);
          if (storedClip && storedClip.animationId) {
            console.log(`[CLIP_LINKING] Found matching animation ID ${storedClip.animationId} for clip at order ${clip.order}`);
            clip.animationId = storedClip.animationId;
          }
        }
      });

      // Additional check: Verify animation files exist for all referenced animationIds
      // This helps catch provider-specific issues with animation storage
      const animationVerificationPromises = movie.clips
        .filter(clip => clip.animationId)
        .map(async clip => {
          try {
            const animation = await storageService.getAnimation(clip.animationId);
            if (!animation) {
              console.warn(`[ANIMATION_VERIFY] Animation ${clip.animationId} for clip ${clip.id} not found in storage`);
              return false;
            }
            if (!animation.svg) {
              console.warn(`[ANIMATION_VERIFY] Animation ${clip.animationId} exists but has no SVG content`);
              return false;
            }
            return true;
          } catch (error) {
            console.error(`[ANIMATION_VERIFY] Error checking animation ${clip.animationId}:`, error);
            return false;
          }
        });

      // Wait for all verification checks to complete
      const animationVerificationResults = await Promise.all(animationVerificationPromises);
      const missingAnimationsCount = animationVerificationResults.filter(result => !result).length;

      if (missingAnimationsCount > 0) {
        console.warn(`[ANIMATION_VERIFY] Found ${missingAnimationsCount} clips with missing or invalid animations`);
      } else {
        console.log(`[ANIMATION_VERIFY] All ${animationVerificationResults.length} animations verified successfully`);
      }

      // Update completion count based on the number of clips we have after the merge
      movie.generationStatus = movie.generationStatus || {
        inProgress: true,
        completedScenes: 0,
        totalScenes: movie.originalScenes?.length || 0,
        status: 'in_progress',
        startedAt: new Date()
      };

      movie.generationStatus.completedScenes = movie.clips.length;
      movie.generationStatus.inProgress = movie.clips.length < (movie.originalScenes?.length || 0);
      movie.generationStatus.status = movie.generationStatus.inProgress ? 'in_progress' : 'completed';

      if (!movie.generationStatus.inProgress && !movie.generationStatus.completedAt) {
        movie.generationStatus.completedAt = new Date();
      }

      // If we've generated all scenes, mark as complete
      if (movie.generationStatus.completedScenes >= movie.generationStatus.totalScenes) {
        movie.generationStatus.inProgress = false;
        movie.generationStatus.completedAt = new Date();
        console.log('[CLIP_LINKING] All scenes completed after merging clips, marked generation as complete');
      }
    }

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

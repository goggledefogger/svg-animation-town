const { v4: uuidv4 } = require('uuid');
const animationService = require('../services/animation.service');
const storageService = require('../services/storage.service');
const storyboardService = require('../services/storyboard.service');
const { ServiceUnavailableError } = require('../utils/errors');

// Store active generation sessions
const activeSessions = new Map();

// Track completed scenes per session
const sessionProgress = new Map();

/**
 * Initialize a new movie generation session
 */
exports.initializeGeneration = async (req, res) => {
  try {
    const { prompt, provider, numScenes } = req.body;

    // Validate request
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    // First, generate a complete storyboard with scene descriptions
    console.log('Generating initial storyboard with scene descriptions...');
    const storyboardResponse = await storyboardService.generateStoryboard(prompt, provider, numScenes);

    // Create new storyboard with the generated content
    const storyboard = {
      id: uuidv4(),
      name: storyboardResponse.title || (prompt.substring(0, 50) + (prompt.length > 50 ? '...' : '')),
      description: storyboardResponse.description || prompt,
      clips: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      aiProvider: provider,
      // Store the scene descriptions for generating clips
      originalScenes: storyboardResponse.scenes,
      // Initialize generation status
      generationStatus: {
        inProgress: true,
        completedScenes: 0,
        totalScenes: storyboardResponse.scenes.length,
        status: 'initializing',
        startedAt: new Date()
      }
    };

    // Save initial storyboard
    await storageService.saveMovie(storyboard);

    // Create a new session
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      storyboardId: storyboard.id,
      prompt,
      provider: provider || 'openai',
      numScenes: storyboardResponse.scenes.length,
      progress: {
        current: 0,
        total: storyboardResponse.scenes.length,
        status: 'initializing'
      },
      clients: new Set(),
      errors: []
    };

    // Store the session
    activeSessions.set(sessionId, session);

    // Return the session ID and storyboard
    res.json({
      success: true,
      sessionId,
      storyboard,
      message: 'Generation session initialized'
    });
  } catch (error) {
    console.error('Error initializing generation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize generation'
    });
  }
};

/**
 * Subscribe to generation progress updates using SSE
 */
exports.subscribeToProgress = async (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Generation session not found'
    });
  }

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Helper to send updates
  const sendUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Add client to session
  session.clients.add(res);

  // Send initial state
  sendUpdate({
    type: 'progress',
    data: session.progress
  });

  // Handle client disconnect
  req.on('close', () => {
    session.clients.delete(res);
  });
};

/**
 * Helper to notify all clients of a session update
 */
function notifyClients(session, additionalData = {}) {
  const update = {
    type: 'progress',
    data: {
      current: session.progress.current,
      total: session.progress.total,
      status: session.progress.status,
      errors: session.errors,
      ...additionalData
    }
  };

  session.clients.forEach(client => {
    client.write(`data: ${JSON.stringify(update)}\n\n`);
  });
}

/**
 * Helper to update session progress atomically
 */
function updateSessionProgress(session, newClip = null) {
  // Get or initialize progress set for this session
  let progressSet = sessionProgress.get(session.id);
  if (!progressSet) {
    progressSet = new Set();
    sessionProgress.set(session.id, progressSet);
  }

  if (newClip) {
    progressSet.add(newClip.order);

    // Add diagnostic log for clip events being sent
    if (newClip.animationId) {
      console.log(`[SERVER_CLIP_EVENT] Sending clip event: order=${newClip.order}, id=${newClip.id}, animationId=${newClip.animationId}, session=${session.id}`);
    }
  }

  // Update progress count atomically
  session.progress.current = progressSet.size;

  // Notify clients of progress
  notifyClients(session, newClip ? { newClip: { clip: newClip } } : undefined);
}

/**
 * Start the generation process for a session
 */
exports.startGeneration = async (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Generation session not found'
    });
  }

  try {
    // Update session status
    session.progress.status = 'generating';
    notifyClients(session);

    // Load the storyboard to get scene descriptions
    const storyboard = await storageService.getMovie(session.storyboardId);
    if (!storyboard || !storyboard.originalScenes) {
      throw new Error('Storyboard or scene descriptions not found');
    }

    // Initialize storyboard status
    storyboard.generationStatus = {
      ...storyboard.generationStatus,
      status: 'generating',
      inProgress: true,
      completedScenes: 0,
      totalScenes: storyboard.originalScenes.length,
      startedAt: new Date(),
      currentSceneIndex: 0,
      activeSessionId: sessionId
    };
    await storageService.saveMovie(storyboard);

    // Create a shared atomic counter for tracking progress
    let currentSceneIndex = 0;

    // Check if we're recovering a paused generation
    const isRecovery = storyboard.generationStatus.recoveredAt !== undefined;
    const startingSceneIndex = isRecovery ? (storyboard.generationStatus.currentSceneIndex || 0) : 0;

    // For recovery, we need to identify which scenes are already completed
    const completedSceneIndices = new Set();
    if (isRecovery && storyboard.clips && Array.isArray(storyboard.clips)) {
      storyboard.clips.forEach(clip => {
        if (clip && clip.order !== undefined) {
          completedSceneIndices.add(clip.order);
          console.log(`[GENERATION] Scene ${clip.order + 1} already completed, will skip generation`);
        }
      });
      console.log(`[GENERATION] Recovery mode: ${completedSceneIndices.size} scenes already complete`);
    }

    // Generate clips for each scene in parallel
    const scenePromises = storyboard.originalScenes.map(async (scene, i) => {
      try {
        // Skip already completed scenes in recovery mode
        if (isRecovery && completedSceneIndices.has(i)) {
          console.log(`[GENERATION] Skipping generation for already completed scene ${i + 1}`);
          // Find the existing clip for this scene
          const existingClip = storyboard.clips.find(clip => clip.order === i);
          if (existingClip) {
            // Log re-sending of existing clip during recovery
            if (existingClip.animationId) {
              console.log(`[SERVER_RECOVERY_EVENT] Re-sending existing clip event in recovery mode: order=${existingClip.order}, id=${existingClip.id}, animationId=${existingClip.animationId}`);
            }

            // Update progress to include this pre-existing clip
            updateSessionProgress(session, existingClip);
            return existingClip;
          }
          return null;
        }

        console.log(`[GENERATION] Starting generation of scene ${i + 1}/${storyboard.originalScenes.length}`);

        // Atomically update the current scene index in the storyboard
        // This ensures we always have a record of which scene is being processed
        if (i >= currentSceneIndex) {
          currentSceneIndex = i;

          // Update storyboard with current scene index
          try {
            const updatedStoryboard = await storageService.getMovie(storyboard.id);
            if (updatedStoryboard && updatedStoryboard.generationStatus) {
              updatedStoryboard.generationStatus.currentSceneIndex = i;
              await storageService.saveMovie(updatedStoryboard);
            }
          } catch (updateError) {
            console.warn(`[GENERATION] Failed to update scene index: ${updateError.message}`);
            // Continue processing even if we couldn't update the index
          }
        }

        // Use the scene's specific prompt for generation
        let result;
        try {
          result = await animationService.generateAnimation(scene.svgPrompt, session.provider);
        } catch (animationError) {
          // Check for rate limit errors or other recoverable errors
          if (animationError.message && (
              animationError.message.includes('rate limit') ||
              animationError.message.includes('too many requests') ||
              animationError.message.includes('429') ||
              animationError.message.includes('temporarily unavailable')
            )) {
            // This is a recoverable error, pause generation
            console.warn(`[GENERATION] Rate limit or service availability error encountered: ${animationError.message}`);

            // Update storyboard with paused status, but don't exit the loop - allow other scenes to continue
            const pausedStoryboard = await storageService.getMovie(storyboard.id);
            if (pausedStoryboard) {
              pausedStoryboard.generationStatus.status = 'paused_rate_limited';
              pausedStoryboard.generationStatus.pausedReason = animationError.message;
              pausedStoryboard.generationStatus.pausedAt = new Date();
              pausedStoryboard.generationStatus.inProgress = true; // Still in progress, just paused
              pausedStoryboard.generationStatus.pausedSceneIndex = i;
              await storageService.saveMovie(pausedStoryboard);

              // Add error to session but continue processing other scenes
              session.errors.push({
                scene: i + 1,
                error: `Generation paused for scene: ${animationError.message}`
              });
              notifyClients(session);
            }

            // Return null for this scene, but allow other scenes to continue
            return null;
          }

          // For other non-recoverable errors, throw to be caught by the scene-level catch
          throw animationError;
        }

        if (!result || !result.svg) {
          throw new Error(`Failed to generate scene ${i + 1}: No SVG content returned`);
        }

        // The animation is already saved by the animation service, use the returned ID
        // Skip saving the animation again to prevent duplicates
        const animationId = result.animationId;

        if (!animationId) {
          console.error(`[GENERATION] Missing animation ID in result for scene ${i + 1}`);
          throw new Error(`Failed to generate scene ${i + 1}: No animation ID returned`);
        }

        console.log(`[GENERATION] Using animation ID from service: ${animationId}`);

        // Create clip with scene-specific information
        const clip = {
          id: uuidv4(),
          name: `Scene ${i + 1}: ${scene.id || ''}`,
          svgContent: result.svg,
          duration: scene.duration || 5,
          order: i,
          prompt: scene.svgPrompt,
          description: scene.description,
          animationId: animationId,
          createdAt: new Date(),
          provider: session.provider,
          chatHistory: [{
            id: uuidv4(),
            sender: 'user',
            text: scene.svgPrompt,
            timestamp: new Date()
          }, {
            id: uuidv4(),
            sender: 'ai',
            text: result.message || 'Scene generated successfully',
            timestamp: new Date()
          }]
        };

        // Update progress atomically
        updateSessionProgress(session, clip);

        // Save clip to storyboard atomically
        await storageService.addClipToMovie(storyboard.id, clip);
        console.log(`[GENERATION] Successfully saved scene ${i + 1}/${storyboard.originalScenes.length}`);

        return clip;
      } catch (error) {
        console.error(`[GENERATION] Error generating scene ${i + 1}:`, error);

        // Just record the error for this specific scene, but allow the others to continue
        session.errors.push({
          scene: i + 1,
          error: error.message
        });
        notifyClients(session);

        return null;
      }
    });

    console.log(`[GENERATION] Started parallel generation of ${session.progress.total} scenes`);

    // Wait for all scenes to be generated
    const clips = await Promise.all(scenePromises);

    // Filter out null results (failed scenes)
    const validClips = clips.filter(clip => clip !== null);

    // Clean up progress tracking
    sessionProgress.delete(session.id);

    // Get final storyboard state with all clips
    const finalStoryboard = await storageService.getMovie(storyboard.id);

    // Count actual valid clips in the final storyboard
    const completedClips = finalStoryboard.clips ? finalStoryboard.clips.filter(clip => clip !== null).length : validClips.length;

    // Determine if we have any paused status
    const hasPausedStatus = finalStoryboard.generationStatus &&
      finalStoryboard.generationStatus.status &&
      finalStoryboard.generationStatus.status.startsWith('paused_');

    // Update final status
    finalStoryboard.generationStatus = {
      inProgress: hasPausedStatus || completedClips < storyboard.originalScenes.length,
      completedScenes: completedClips,
      totalScenes: storyboard.originalScenes.length,
      status: hasPausedStatus ? finalStoryboard.generationStatus.status :
        session.errors.length > 0 ? 'completed_with_errors' :
        completedClips < storyboard.originalScenes.length ? 'in_progress' : 'completed',
      startedAt: storyboard.generationStatus.startedAt,
      completedAt: (!hasPausedStatus && completedClips >= storyboard.originalScenes.length) ? new Date() : undefined,
      currentSceneIndex: currentSceneIndex,
      activeSessionId: (hasPausedStatus || completedClips < storyboard.originalScenes.length) ? sessionId : null
    };

    // Save final state
    await storageService.saveMovie(finalStoryboard);

    // Update session status
    session.progress.status = hasPausedStatus ? 'in_progress' :
      session.errors.length > 0 ? 'completed_with_errors' : 'completed';
    notifyClients(session);

    // Return final status
    res.json({
      success: true,
      sessionId,
      progress: session.progress,
      errors: session.errors,
      status: finalStoryboard.generationStatus.status,
      pausedReason: finalStoryboard.generationStatus.pausedReason
    });

  } catch (error) {
    console.error('[GENERATION] Error during generation:', error);

    // Try to update the storyboard status if possible
    try {
      const storyboard = await storageService.getMovie(session.storyboardId);
      if (storyboard && storyboard.generationStatus) {
        storyboard.generationStatus.status = 'paused_error';
        storyboard.generationStatus.pausedReason = error.message;
        storyboard.generationStatus.pausedAt = new Date();
        storyboard.generationStatus.inProgress = true; // Still in progress, just paused
        await storageService.saveMovie(storyboard);
      }
    } catch (saveError) {
      console.error("[GENERATION] Failed to update storyboard status after error:", saveError);
    }

    session.progress.status = 'failed';
    session.errors.push({
      scene: 'all',
      error: error.message
    });
    notifyClients(session);

    res.status(500).json({
      success: false,
      error: error.message || 'Generation failed'
    });
  }
};

/**
 * Clean up a completed session
 */
exports.cleanupSession = async (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Generation session not found'
    });
  }

  // Notify clients of cleanup
  const update = {
    type: 'cleanup',
    data: { message: 'Session cleaned up' }
  };
  session.clients.forEach(client => {
    client.write(`data: ${JSON.stringify(update)}\n\n`);
    client.end();
  });

  // Remove session
  activeSessions.delete(sessionId);

  res.json({
    success: true,
    message: 'Session cleaned up successfully'
  });
};

/**
 * Recovery handler for paused or stale generation processes
 * This can be called by a periodic job or on server startup
 */
exports.recoveryHandler = async (req, res) => {
  console.log('[RECOVERY] Scanning for paused or stale generation processes');

  try {
    // Get all movies from storage
    const allMovies = await storageService.listMovies();

    // Filter to find movies with paused or stale generation status
    const pausedMovies = allMovies.filter(movie => {
      if (!movie.generationStatus) return false;

      const { status, inProgress, completedScenes, totalScenes } = movie.generationStatus;

      // Check for paused status
      const isPaused = status && (
        status === 'paused_rate_limited' ||
        status === 'paused_error' ||
        status.startsWith('paused_')
      );

      // Check for stale generating status (stuck in generating without progress)
      const isStaleGenerating = status === 'generating' && inProgress === true &&
        completedScenes < totalScenes;

      return isPaused || isStaleGenerating;
    });

    console.log(`[RECOVERY] Found ${pausedMovies.length} movies requiring recovery`);

    // Process each paused movie
    const recoveryResults = await Promise.all(pausedMovies.map(async (movie) => {
      try {
        console.log(`[RECOVERY] Processing movie ${movie.id}: "${movie.name}"`);

        // Create a new session for this recovery
        const sessionId = uuidv4();
        const status = movie.generationStatus.status || 'unknown';

        // Determine starting scene index - use pausedSceneIndex if available,
        // or currentSceneIndex, or fall back to completedScenes
        let startingSceneIndex = 0;

        if (movie.generationStatus.pausedSceneIndex !== undefined) {
          startingSceneIndex = movie.generationStatus.pausedSceneIndex;
          console.log(`[RECOVERY] Using pausedSceneIndex ${startingSceneIndex}`);
        } else if (movie.generationStatus.currentSceneIndex !== undefined) {
          startingSceneIndex = movie.generationStatus.currentSceneIndex;
          console.log(`[RECOVERY] Using currentSceneIndex ${startingSceneIndex}`);
        } else {
          startingSceneIndex = movie.generationStatus.completedScenes || 0;
          console.log(`[RECOVERY] Using completedScenes ${startingSceneIndex}`);
        }

        const completedScenes = movie.generationStatus.completedScenes || 0;
        const totalScenes = movie.generationStatus.totalScenes ||
          (movie.originalScenes ? movie.originalScenes.length : 0);

        console.log(`[RECOVERY] Movie ${movie.id} status: ${status}, scene: ${startingSceneIndex + 1}/${totalScenes}, completed: ${completedScenes}`);

        // If the paused scene is already completed (which can happen if some parallel scenes finished),
        // move to the next one
        if (startingSceneIndex < totalScenes && startingSceneIndex < completedScenes) {
          startingSceneIndex = completedScenes;
          console.log(`[RECOVERY] Adjusting to use completedScenes as starting point: ${startingSceneIndex}`);
        }

        // Create recovery session
        const session = {
          id: sessionId,
          storyboardId: movie.id,
          prompt: movie.description || 'Recovered generation',
          provider: movie.aiProvider || 'openai',
          numScenes: totalScenes,
          progress: {
            current: completedScenes,
            total: totalScenes,
            status: 'initializing'
          },
          clients: new Set(),
          errors: []
        };

        // Store the session
        activeSessions.set(sessionId, session);

        // Update the movie with the new session ID and resumed status
        movie.generationStatus = {
          ...movie.generationStatus,
          status: 'generating',
          inProgress: true,
          currentSceneIndex: startingSceneIndex,
          activeSessionId: sessionId,
          recoveredAt: new Date(),
          recoveryInfo: {
            previousStatus: status,
            previousSceneIndex: movie.generationStatus.currentSceneIndex,
            resumedFrom: startingSceneIndex,
            recoveryMethod: 'parallel'
          }
        };

        await storageService.saveMovie(movie);

        console.log(`[RECOVERY] Successfully initialized recovery for movie ${movie.id}, starting from scene ${startingSceneIndex + 1}`);

        // If this is being called via the API, we'll just initialize the session
        // The caller will need to trigger the actual generation
        if (req && res) {
          return {
            movieId: movie.id,
            sessionId,
            name: movie.name,
            status: 'recovery_initialized',
            startingFrom: startingSceneIndex
          };
        }

        // If this is being called as an automatic recovery (startup/scheduled),
        // start the generation process automatically
        try {
          console.log(`[RECOVERY] Automatically starting generation for recovered movie ${movie.id}`);

          // Create a mock request/response to pass to startGeneration
          const mockReq = { params: { sessionId } };
          const mockRes = {
            json: (data) => {
              console.log(`[RECOVERY] Generated recovery response for movie ${movie.id}:`, data);
              return data;
            },
            status: (code) => ({
              json: (data) => {
                console.log(`[RECOVERY] Generated recovery error response (${code}) for movie ${movie.id}:`, data);
                return data;
              }
            })
          };

          // Start the generation process
          await exports.startGeneration(mockReq, mockRes);

          return {
            movieId: movie.id,
            sessionId,
            name: movie.name,
            status: 'recovery_started',
            startingFrom: startingSceneIndex
          };
        } catch (genError) {
          console.error(`[RECOVERY] Error auto-starting generation for movie ${movie.id}:`, genError);
          return {
            movieId: movie.id,
            sessionId,
            status: 'recovery_init_only',
            error: genError.message
          };
        }
      } catch (error) {
        console.error(`[RECOVERY] Error recovering movie ${movie.id}:`, error);
        return {
          movieId: movie.id,
          status: 'recovery_failed',
          error: error.message
        };
      }
    }));

    if (res) {
      // If this was called as an API endpoint, return results
      res.json({
        success: true,
        recovered: recoveryResults
      });
    }

    return recoveryResults;
  } catch (error) {
    console.error('[RECOVERY] Error during recovery scan:', error);

    if (res) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return { error: error.message };
  }
};

// Execute recovery on startup
(async () => {
  try {
    // Wait a few seconds to allow the server to initialize
    setTimeout(async () => {
      console.log('[STARTUP] Running initial recovery scan');
      await exports.recoveryHandler();

      // Set up periodic recovery scan every 15 minutes
      setInterval(async () => {
        console.log('[SCHEDULED] Running periodic recovery scan');
        await exports.recoveryHandler();
      }, 15 * 60 * 1000); // 15 minutes
    }, 5000); // 5 second delay
  } catch (error) {
    console.error('[STARTUP] Error during startup recovery:', error);
  }
})();

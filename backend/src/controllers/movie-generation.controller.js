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
    const { prompt, provider, numScenes, existingMovieId } = req.body;

    // Validate request
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    let storyboard;

    // If we have an existingMovieId, try to load it
    if (existingMovieId) {
      console.log(`Attempting to reuse existing movie: ${existingMovieId}`);
      const existingMovie = await storageService.getMovie(existingMovieId);
      
      if (existingMovie) {
        console.log(`Found existing movie: ${existingMovie.name}`);
        storyboard = {
          ...existingMovie,
          updatedAt: new Date(),
          // Update generation status
          generationStatus: {
            ...existingMovie.generationStatus,
            status: 'initializing',
            startedAt: new Date()
          }
        };
      } else {
        console.log(`Existing movie ${existingMovieId} not found, creating new one`);
      }
    }

    // If we don't have a storyboard yet (no existingMovieId or not found), create a new one
    if (!storyboard) {
      // First, generate a complete storyboard with scene descriptions
      console.log('Generating initial storyboard with scene descriptions...');
      const storyboardResponse = await storyboardService.generateStoryboard(prompt, provider, numScenes);

      // Create new storyboard with the generated content
      storyboard = {
        id: existingMovieId || uuidv4(), // Use existing ID if provided
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
    }

    // Save storyboard
    await storageService.saveMovie(storyboard);

    // Create a new session
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      storyboardId: storyboard.id,
      prompt: storyboard.description,
      provider: provider || 'openai',
      numScenes: storyboard.originalScenes.length,
      progress: {
        current: 0,
        total: storyboard.originalScenes.length,
        status: 'initializing'
      },
      clients: new Set(),
      errors: []
    };

    // Store the session
    activeSessions.set(sessionId, session);

    // Update the storyboard with the active session
    storyboard.generationStatus.activeSessionId = sessionId;
    await storageService.saveMovie(storyboard);

    // Return the session ID and storyboard
    res.json({
      success: true,
      sessionId,
      storyboard,
      message: existingMovieId ? 'Restarting generation for existing movie' : 'Generation session initialized'
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
    console.log(`[SSE_UPDATE] Sending clip update for session ${session.id}: scene=${newClip.order + 1}, clipId=${newClip.id}`);
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
  
  // Strategic log #1: Log the API call with details
  console.log(`[GENERATION_DEBUG] startGeneration called for sessionId: ${sessionId}, method: ${req.method}, url: ${req.originalUrl}, client: ${req.ip}`);
  
  const session = activeSessions.get(sessionId);

  if (!session) {
    console.log(`[GENERATION_DEBUG] Session not found in activeSessions map. Active sessions: ${Array.from(activeSessions.keys()).join(', ')}`);
    return res.status(404).json({
      success: false,
      error: 'Generation session not found'
    });
  }

  try {
    // Update session status
    session.progress.status = 'generating';
    notifyClients(session);
    console.log(`[GENERATION] Starting generation for session ${sessionId}`);

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

    // Generate clips for each scene in parallel
    const scenePromises = storyboard.originalScenes.map(async (scene, i) => {
      try {
        console.log(`[GENERATION] Starting scene ${i + 1}/${storyboard.originalScenes.length}`);

        // Strategic log #2: Log details about the animation generation call
        console.log(`[SVG_GENERATION_DEBUG] Calling animationService.generateAnimation for scene ${i + 1}:
          - Provider: ${session.provider}
          - Scene ID: ${scene.id || 'unknown'}
          - Prompt length: ${scene.svgPrompt?.length || 0} chars
          - Active session ID: ${sessionId}
          - Storyboard ID: ${session.storyboardId}`);

        // Use the scene's specific prompt for generation
        const result = await animationService.generateAnimation(scene.svgPrompt, session.provider);

        if (!result || !result.svg) {
          throw new Error(`Failed to generate scene ${i + 1}: No SVG content returned`);
        }

        const animationId = result.animationId;
        if (!animationId) {
          throw new Error(`Failed to generate scene ${i + 1}: No animation ID returned`);
        }

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

        // Update progress atomically and notify clients
        updateSessionProgress(session, clip);

        // Save clip to storyboard atomically
        await storageService.addClipToMovie(storyboard.id, clip);
        console.log(`[GENERATION] Completed scene ${i + 1}/${storyboard.originalScenes.length}`);

        return clip;
      } catch (error) {
        console.error(`[GENERATION] Error generating scene ${i + 1}:`, error);
        session.errors.push({
          scene: i + 1,
          error: error.message
        });
        notifyClients(session);
        return null;
      }
    });

    // Wait for all scenes to be generated
    const clips = await Promise.all(scenePromises);
    const validClips = clips.filter(clip => clip !== null);

    // Clean up progress tracking
    sessionProgress.delete(session.id);

    // Get final storyboard state with all clips
    const finalStoryboard = await storageService.getMovie(storyboard.id);
    const completedClips = finalStoryboard.clips ? finalStoryboard.clips.filter(clip => clip !== null).length : validClips.length;

    // Update final status
    finalStoryboard.generationStatus = {
      inProgress: completedClips < storyboard.originalScenes.length,
      completedScenes: completedClips,
      totalScenes: storyboard.originalScenes.length,
      status: session.errors.length > 0 ? 'completed_with_errors' : 'completed',
      startedAt: storyboard.generationStatus.startedAt,
      completedAt: new Date(),
      activeSessionId: null
    };

    // Save final state
    await storageService.saveMovie(finalStoryboard);

    // Update session status and notify clients
    session.progress.status = session.errors.length > 0 ? 'completed_with_errors' : 'completed';
    notifyClients(session);

    console.log(`[GENERATION] Completed generation for session ${sessionId}: ${completedClips}/${storyboard.originalScenes.length} scenes`);

    // Return final status
    res.json({
      success: true,
      sessionId,
      progress: session.progress,
      errors: session.errors,
      status: finalStoryboard.generationStatus.status
    });

  } catch (error) {
    console.error('[GENERATION] Error during generation:', error);
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

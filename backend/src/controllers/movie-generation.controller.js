const { v4: uuidv4 } = require('uuid');
const animationService = require('../services/animation.service');
const storageService = require('../services/storage.service');
const { ServiceUnavailableError } = require('../utils/errors');

// Store active generation sessions
const activeSessions = new Map();

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

    // Create a new session
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      prompt,
      provider: provider || 'openai',
      numScenes: numScenes || 5,
      progress: {
        current: 0,
        total: numScenes || 5,
        status: 'initializing',
        scenes: []
      },
      clients: new Set(),
      errors: []
    };

    // Store the session
    activeSessions.set(sessionId, session);

    // Return the session ID
    res.json({
      success: true,
      sessionId,
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
 * Start the generation process for a session
 */
exports.startGeneration = async (req, res) => {
  const { sessionId } = req.params;
  const { movieId } = req.body; // Add movieId to request body
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Generation session not found'
    });
  }

  try {
    // Load existing movie if movieId provided
    let movie = movieId ? await storageService.getMovie(movieId) : null;
    if (!movie) {
      // Create new movie if none exists
      movie = {
        id: movieId || uuidv4(),
        name: session.prompt.substring(0, 50) + (session.prompt.length > 50 ? '...' : ''),
        description: session.prompt,
        clips: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    // Update session status
    session.progress.status = 'generating';
    notifyClients(session);

    // Process each scene
    for (let i = 0; i < session.progress.total; i++) {
      try {
        // Generate scene
        const scenePrompt = `Scene ${i + 1} of ${session.progress.total}: ${session.prompt}`;
        const result = await animationService.generateAnimation(scenePrompt, session.provider);

        if (!result || !result.svg) {
          throw new Error('Animation generation failed: No SVG content returned');
        }

        // Ensure we have an animationId
        const animationId = result.animationId || uuidv4();

        // Save the animation
        await storageService.saveAnimation({
          id: animationId,
          name: `Scene ${i + 1} - ${session.prompt.substring(0, 50)}${session.prompt.length > 50 ? '...' : ''}`,
          svg: result.svg,
          prompt: scenePrompt,
          timestamp: new Date().toISOString(),
          provider: session.provider
        });

        // Create clip
        const clipId = uuidv4();
        const clip = {
          id: clipId,
          name: `Scene ${i + 1}`,
          svgContent: result.svg,
          duration: 5, // Default duration
          order: i,
          prompt: scenePrompt,
          animationId: animationId,
          createdAt: new Date(),
          provider: session.provider
        };

        // Add clip to movie
        movie.clips.push(clip);

        // Store scene with animationId
        session.progress.scenes.push({
          index: i,
          svg: result.svg,
          message: result.message,
          animationId: animationId,
          prompt: scenePrompt
        });

        // Update progress
        session.progress.current = i + 1;
        session.progress.status = 'in_progress';
        notifyClients(session);

        // Save movie after each successful clip generation
        movie.updatedAt = new Date();
        await storageService.saveMovie(movie);

      } catch (error) {
        console.error(`Error generating scene ${i + 1}:`, error);
        session.errors.push({
          scene: i + 1,
          error: error.message
        });
      }
    }

    // Mark as complete
    session.progress.status = session.errors.length > 0 ? 'completed_with_errors' : 'completed';
    notifyClients(session);

    // Save final movie state
    movie.updatedAt = new Date();
    const savedMovieId = await storageService.saveMovie(movie);

    // Return final status
    res.json({
      success: true,
      sessionId,
      movieId: savedMovieId,
      progress: session.progress,
      errors: session.errors
    });

  } catch (error) {
    console.error('Error during generation:', error);
    session.progress.status = 'failed';
    session.errors.push({
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
 * Helper to notify all clients of a session update
 */
function notifyClients(session) {
  const update = {
    type: 'progress',
    data: {
      current: session.progress.current,
      total: session.progress.total,
      status: session.progress.status,
      errors: session.errors
    }
  };

  session.clients.forEach(client => {
    client.write(`data: ${JSON.stringify(update)}\n\n`);
  });
}

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

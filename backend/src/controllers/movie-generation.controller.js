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

    // Create new storyboard
    const storyboard = {
      id: uuidv4(),
      name: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      description: prompt,
      clips: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      aiProvider: provider
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
      numScenes: numScenes || 5,
      progress: {
        current: 0,
        total: numScenes || 5,
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
        const clip = {
          id: uuidv4(),
          name: `Scene ${i + 1}`,
          svgContent: result.svg,
          duration: 5,
          order: i,
          prompt: scenePrompt,
          animationId: animationId,
          createdAt: new Date(),
          provider: session.provider,
          chatHistory: [{
            id: uuidv4(),
            sender: 'user',
            text: scenePrompt,
            timestamp: new Date()
          }, {
            id: uuidv4(),
            sender: 'ai',
            text: result.message || 'Scene generated successfully',
            timestamp: new Date()
          }]
        };

        // Load current storyboard
        const storyboard = await storageService.getMovie(session.storyboardId);
        if (!storyboard) {
          throw new Error('Storyboard not found');
        }

        // Add clip to storyboard
        storyboard.clips.push(clip);
        storyboard.updatedAt = new Date();

        // Save updated storyboard
        await storageService.saveMovie(storyboard);

        // Update progress and notify clients with new clip
        session.progress.current = i + 1;
        session.progress.status = 'in_progress';
        notifyClients(session, { newClip: { clip } });

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

    // Return final status
    res.json({
      success: true,
      sessionId,
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

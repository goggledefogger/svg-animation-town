const { v4: uuidv4 } = require('uuid');
const animationService = require('../services/animation.service');
const storageService = require('../services/storage.service');
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
    // Initialize progress tracking for this session
    sessionProgress.set(session.id, new Set());

    // Update session status
    session.progress.status = 'generating';
    session.progress.current = 0;
    notifyClients(session);

    // Create array of scene generation promises
    const scenePromises = Array.from({ length: session.progress.total }, async (_, i) => {
      try {
        console.log(`Starting generation of scene ${i + 1}`);
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

        console.log(`Completed generation of scene ${i + 1}`);

        // Update progress atomically and notify clients
        updateSessionProgress(session, clip);

        return clip;
      } catch (error) {
        console.error(`Error generating scene ${i + 1}:`, error);
        session.errors.push({
          scene: i + 1,
          error: error.message
        });
        notifyClients(session);
        return null;
      }
    });

    console.log(`Started parallel generation of ${session.progress.total} scenes`);

    // Wait for all scenes to be generated
    const clips = await Promise.all(scenePromises);

    // Clean up progress tracking
    sessionProgress.delete(session.id);

    // Filter out failed clips and add successful ones to storyboard
    const validClips = clips.filter(clip => clip !== null);

    // Sort clips by order to maintain sequence
    validClips.sort((a, b) => a.order - b.order);

    // Load current storyboard
    const storyboard = await storageService.getMovie(session.storyboardId);
    if (!storyboard) {
      throw new Error('Storyboard not found');
    }

    // Add all successful clips to storyboard
    storyboard.clips.push(...validClips);
    storyboard.updatedAt = new Date();

    // Save updated storyboard
    await storageService.saveMovie(storyboard);

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
    sessionProgress.delete(session.id);

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

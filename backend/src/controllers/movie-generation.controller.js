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
      originalScenes: storyboardResponse.scenes
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

    // Generate clips for each scene in parallel
    const scenePromises = storyboard.originalScenes.map(async (scene, i) => {
      try {
        // Use the scene's specific prompt for generation
        const result = await animationService.generateAnimation(scene.svgPrompt, session.provider);

        // Save the animation
        const animationId = uuidv4();
        await storageService.saveAnimation({
          id: animationId,
          name: `Scene ${i + 1}: ${scene.id || ''}`,
          svg: result.svg,
          timestamp: new Date().toISOString(),
          provider: session.provider
        });

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

    // Update storyboard with generated clips
    storyboard.clips.push(...validClips);
    storyboard.updatedAt = new Date();

    // Save updated storyboard
    await storageService.saveMovie(storyboard);

    // Update session status
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

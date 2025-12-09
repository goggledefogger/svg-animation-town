const express = require('express');
const animationRoutes = require('./animation.routes');
const movieRoutes = require('./movie.routes');
const config = require('../config');
const modelFetcher = require('../services/model-fetcher.service');

const router = express.Router();

// Animation related routes
router.use('/animation', animationRoutes);

// Movie related routes
router.use('/movie', movieRoutes);

// Config route - returns non-sensitive configuration
router.get('/config', async (req, res) => {
  try {
    // Check if we should force refresh (for debugging/admin purposes)
    const forceRefresh = req.query.refresh === 'true';

    // Try to get dynamic models, fallback to static if it fails
    let providers = config.publicProviders;
    try {
      providers = await modelFetcher.getPublicProviderInfoWithDynamicModels(forceRefresh);
      console.log('[Config Route] Using dynamically fetched models');
    } catch (error) {
      console.warn('[Config Route] Dynamic model fetch failed, using static models:', error.message);
      // Fallback to static providers already set above
    }

    // Only return safe configuration values that can be exposed to the frontend
    res.json({
      success: true,
      config: {
        aiProvider: config.aiProvider,
        providers: providers,
        defaults: config.defaults,
        currentModels: {
          openai: config.openai.model,
          anthropic: config.anthropic.model,
          google: config.google.model
        }
      }
    });
  } catch (error) {
    console.error('[Config Route] Error generating config:', error);
    // Return static config as fallback
    res.json({
      success: true,
      config: {
        aiProvider: config.aiProvider,
        providers: config.publicProviders,
        defaults: config.defaults,
        currentModels: {
          openai: config.openai.model,
          anthropic: config.anthropic.model,
          google: config.google.model
        }
      }
    });
  }
});

module.exports = router;

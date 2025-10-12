const express = require('express');
const animationRoutes = require('./animation.routes');
const movieRoutes = require('./movie.routes');
const config = require('../config');

const router = express.Router();

// Animation related routes
router.use('/animation', animationRoutes);

// Movie related routes
router.use('/movie', movieRoutes);

// Config route - returns non-sensitive configuration
router.get('/config', (req, res) => {
  // Only return safe configuration values that can be exposed to the frontend
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
});

module.exports = router;

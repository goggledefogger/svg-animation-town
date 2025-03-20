const express = require('express');
const animationController = require('../controllers/animation.controller');
const animationStorageController = require('../controllers/animation.storage.controller');
const claudeService = require('../services/claude.service');
const { asyncHandler } = require('../utils/errors');

const router = express.Router();

// POST endpoint to generate animation based on text prompt
router.post('/generate', animationController.generateAnimation);

// POST endpoint to update existing animation
router.post('/update', animationController.updateAnimation);

// GET endpoint to fetch animation presets
router.get('/presets/:name', animationController.getPreset);

// Animation storage endpoints
router.post('/save', animationStorageController.saveAnimation);
router.get('/list', animationStorageController.listAnimations);
router.get('/:id', animationStorageController.getAnimation);
router.delete('/:id', animationStorageController.deleteAnimation);

// DEBUG endpoint to test Claude rate limiter (disabled in production)
if (process.env.NODE_ENV !== 'production') {
  router.get('/debug/rate-limiter-status', asyncHandler(async (req, res) => {
    // Get the current state of the rate limiter from the Claude service
    const { tokenBucket, tokensPerRequest, maxConcurrentRequests, currentRequests, requestQueue } = claudeService.getRateLimiterStatus();

    res.json({
      tokenBucket,
      tokensPerRequest,
      maxConcurrentRequests,
      currentRequests,
      queueLength: requestQueue?.length || 0,
      message: 'This endpoint is only available in non-production environments'
    });
  }));
}

module.exports = router;

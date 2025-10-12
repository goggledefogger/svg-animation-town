const express = require('express');
const animationController = require('../controllers/animation.controller');
const animationStorageController = require('../controllers/animation.storage.controller');
const AIService = require('../services/ai.service');
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
    // Get the current state of the unified rate limiter
    const status = AIService.getRateLimiterStatus();

    res.json({
      status,
      message: 'This endpoint is only available in non-production environments'
    });
  }));
}

module.exports = router;

const express = require('express');
const animationController = require('../controllers/animation.controller');

const router = express.Router();

// POST endpoint to generate animation based on text prompt
router.post('/generate', animationController.generateAnimation);

// POST endpoint to update existing animation
router.post('/update', animationController.updateAnimation);

// GET endpoint to fetch animation presets
router.get('/presets/:name', animationController.getPreset);

module.exports = router;

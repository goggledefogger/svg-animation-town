const express = require('express');
const animationController = require('../controllers/animation.controller');
const animationStorageController = require('../controllers/animation.storage.controller');

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

module.exports = router;

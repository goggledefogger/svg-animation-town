const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/errors');
const movieController = require('../controllers/movie.controller');
const movieStorageController = require('../controllers/movie.storage.controller');
const movieGenerationController = require('../controllers/movie-generation.controller');

/**
 * @route POST /api/movie/generate-storyboard
 * @desc Generate a storyboard from a text prompt
 * @access Public
 */
router.post('/generate-storyboard', asyncHandler(movieController.generateStoryboard));

/**
 * @route POST /api/movie/generate-scene
 * @desc Generate a scene animation with movie context
 * @access Public
 */
router.post('/generate-scene', asyncHandler(movieController.generateScene));

/**
 * Movie storage endpoints
 */
router.post('/save', asyncHandler(movieStorageController.saveMovie));
router.get('/list', asyncHandler(movieStorageController.listMovies));
router.get('/:id', asyncHandler(movieStorageController.getMovie));
router.delete('/:id', asyncHandler(movieStorageController.deleteMovie));

/**
 * Animation data endpoint for clips
 */
router.get('/clip-animation/:animationId', asyncHandler(movieStorageController.getClipAnimation));

// Movie generation routes (new SSE-based endpoints)
router.post('/generate/initialize', asyncHandler(movieGenerationController.initializeGeneration));
router.get('/generate/:sessionId/progress', asyncHandler(movieGenerationController.subscribeToProgress));
router.post('/generate/:sessionId/start', asyncHandler(movieGenerationController.startGeneration));
router.delete('/generate/:sessionId', asyncHandler(movieGenerationController.cleanupSession));

module.exports = router;

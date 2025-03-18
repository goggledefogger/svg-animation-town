const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movie.controller');
const movieStorageController = require('../controllers/movie.storage.controller');

/**
 * @route POST /api/movie/generate-storyboard
 * @desc Generate a storyboard from a text prompt
 * @access Public
 */
router.post('/generate-storyboard', movieController.generateStoryboard);

/**
 * Movie storage endpoints
 */
router.post('/save', movieStorageController.saveMovie);
router.get('/list', movieStorageController.listMovies);
router.get('/:id', movieStorageController.getMovie);
router.delete('/:id', movieStorageController.deleteMovie);

/**
 * Animation data endpoint for clips
 */
router.get('/clip-animation/:animationId', movieStorageController.getClipAnimation);

module.exports = router;

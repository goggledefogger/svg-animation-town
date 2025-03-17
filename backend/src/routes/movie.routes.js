const express = require('express');
const router = express.Router();
const movieController = require('../controllers/movie.controller');

/**
 * @route POST /api/movie/generate-storyboard
 * @desc Generate a storyboard from a text prompt
 * @access Public
 */
router.post('/generate-storyboard', movieController.generateStoryboard);

module.exports = router;

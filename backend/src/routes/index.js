const express = require('express');
const animationRoutes = require('./animation.routes');
const movieRoutes = require('./movie.routes');

const router = express.Router();

// Animation related routes
router.use('/animation', animationRoutes);

// Movie related routes
router.use('/movie', movieRoutes);

module.exports = router;

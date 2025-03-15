const express = require('express');
const animationRoutes = require('./animation.routes');

const router = express.Router();

// Animation related routes
router.use('/animation', animationRoutes);

module.exports = router;

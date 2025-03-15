require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const { NotFoundError } = require('./utils/errors');
const config = require('./config');

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is healthy',
    environment: config.server.nodeEnv
  });
});

// 404 handler for undefined routes
app.use('*', (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Global error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`Gotham Animation Studio backend running on port ${PORT} in ${config.server.nodeEnv} mode`);
});

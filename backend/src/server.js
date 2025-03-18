require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const { NotFoundError } = require('./utils/errors');
const config = require('./config');
const storageService = require('./services/storage.service');
const path = require('path');

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors(config.cors));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from output directory
app.use('/api/files', express.static(path.join(__dirname, 'output')));

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

// Initialize storage service before starting the server
async function startServer() {
  try {
    await storageService.init();

    // Start the server
    app.listen(PORT, () => {
      console.log(`Gotham Animation Studio backend running on port ${PORT} in ${config.server.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

startServer();

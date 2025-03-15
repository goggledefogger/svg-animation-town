/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error for debugging
  console.error('Error:', err);

  // Set default values
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Send the error response
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;

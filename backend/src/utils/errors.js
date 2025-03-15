/**
 * Custom API Error class
 */
class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
class BadRequestError extends ApiError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends ApiError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * Service Unavailable Error (503)
 */
class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service unavailable') {
    super(message, 503);
  }
}

/**
 * Async handler to avoid try/catch blocks in route handlers
 * @param {Function} fn - The async function to handle
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  ApiError,
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
  asyncHandler
};

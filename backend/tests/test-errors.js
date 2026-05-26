const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  ApiError,
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError
} = require('../src/utils/errors');

describe('ApiError classes', () => {
  test('ApiError should have correct properties', () => {
    const message = 'Generic API Error';
    const statusCode = 500;
    const error = new ApiError(message, statusCode);

    assert.strictEqual(error.message, message);
    assert.strictEqual(error.statusCode, statusCode);
    assert.strictEqual(error.name, 'ApiError');
    assert.ok(error.stack);
    assert.ok(error instanceof Error);
  });

  describe('BadRequestError', () => {
    test('should have default values', () => {
      const error = new BadRequestError();
      assert.strictEqual(error.message, 'Bad Request');
      assert.strictEqual(error.statusCode, 400);
      assert.strictEqual(error.name, 'BadRequestError');
    });

    test('should support custom message', () => {
      const customMessage = 'Invalid input data';
      const error = new BadRequestError(customMessage);
      assert.strictEqual(error.message, customMessage);
      assert.strictEqual(error.statusCode, 400);
    });
  });

  describe('NotFoundError', () => {
    test('should have default values', () => {
      const error = new NotFoundError();
      assert.strictEqual(error.message, 'Resource not found');
      assert.strictEqual(error.statusCode, 404);
      assert.strictEqual(error.name, 'NotFoundError');
    });

    test('should support custom message', () => {
      const customMessage = 'User not found';
      const error = new NotFoundError(customMessage);
      assert.strictEqual(error.message, customMessage);
      assert.strictEqual(error.statusCode, 404);
    });
  });

  describe('ServiceUnavailableError', () => {
    test('should have default values', () => {
      const error = new ServiceUnavailableError();
      assert.strictEqual(error.message, 'Service unavailable');
      assert.strictEqual(error.statusCode, 503);
      assert.strictEqual(error.name, 'ServiceUnavailableError');
    });

    test('should support custom message', () => {
      const customMessage = 'Database connection failed';
      const error = new ServiceUnavailableError(customMessage);
      assert.strictEqual(error.message, customMessage);
      assert.strictEqual(error.statusCode, 503);
    });
  });
});

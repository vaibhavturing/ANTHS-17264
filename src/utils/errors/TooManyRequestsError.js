// src/utils/errors/TooManyRequestsError.js

// ADDITION: New file
const BaseError = require('./BaseError');

/**
 * Error class for rate limit exceeded errors
 * Uses HTTP status code 429 (Too Many Requests)
 */
class TooManyRequestsError extends BaseError {
  /**
   * Create a new TooManyRequestsError
   * @param {string} message - Error message
   * @param {Object} metadata - Additional error metadata
   */
  constructor(message = 'Too many requests', metadata = {}) {
    super(message, 'TOO_MANY_REQUESTS', 429, metadata);
  }
}

module.exports = TooManyRequestsError;
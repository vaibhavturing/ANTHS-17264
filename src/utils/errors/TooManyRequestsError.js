// src/utils/errors/TooManyRequestsError.js

const BaseError = require('./BaseError');

class TooManyRequestsError extends BaseError {
  constructor(message = 'Too many requests', metadata = {}) {
    super(message, 'TOO_MANY_REQUESTS', 429, metadata);
  }
}

module.exports = TooManyRequestsError;
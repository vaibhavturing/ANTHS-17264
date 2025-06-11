/**
 * Custom error classes for the application
 */

// Base application error
class ApplicationError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode || 500;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 400 - Bad Request Error
class ValidationError extends ApplicationError {
  constructor(message) {
    super(message || 'Validation error', 400);
  }
}

// 401 - Unauthorized Error
class AuthenticationError extends ApplicationError {
  constructor(message) {
    super(message || 'Authentication failed', 401);
  }
}

// 403 - Forbidden Error
class AuthorizationError extends ApplicationError {
  constructor(message) {
    super(message || 'You do not have permission to perform this action', 403);
  }
}

// 404 - Not Found Error
class NotFoundError extends ApplicationError {
  constructor(message) {
    super(message || 'Resource not found', 404);
  }
}

// 409 - Conflict Error
class ConflictError extends ApplicationError {
  constructor(message) {
    super(message || 'Resource conflict', 409);
  }
}

// 429 - Too Many Requests
class RateLimitError extends ApplicationError {
  constructor(message) {
    super(message || 'Too many requests, please try again later', 429);
  }
}

// 500 - Internal Server Error
class InternalServerError extends ApplicationError {
  constructor(message) {
    super(message || 'Internal server error', 500);
  }
}

// Export all error classes
module.exports = {
  ApplicationError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError
};
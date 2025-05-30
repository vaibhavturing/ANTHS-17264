/**
 * Healthcare Management Application
 * API Error Utility
 * 
 * Custom error classes for API error handling
 */

const { StatusCodes } = require('http-status-codes');

/**
 * Base API Error class
 */
class APIError extends Error {
  /**
   * Create a new API Error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad Request Error (400)
 */
class BadRequestError extends APIError {
  /**
   * Create a new Bad Request Error
   * @param {string} message - Error message
   */
  constructor(message = 'Bad request') {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

/**
 * Unauthorized Error (401)
 */
class UnauthorizedError extends APIError {
  /**
   * Create a new Unauthorized Error
   * @param {string} message - Error message
   */
  constructor(message = 'Authentication failed') {
    super(message, StatusCodes.UNAUTHORIZED);
  }
}

/**
 * Forbidden Error (403)
 */
class ForbiddenError extends APIError {
  /**
   * Create a new Forbidden Error
   * @param {string} message - Error message
   */
  constructor(message = 'You do not have permission to perform this action') {
    super(message, StatusCodes.FORBIDDEN);
  }
}

/**
 * Not Found Error (404)
 */
class NotFoundError extends APIError {
  /**
   * Create a new Not Found Error
   * @param {string} message - Error message
   */
  constructor(message = 'Resource not found') {
    super(message, StatusCodes.NOT_FOUND);
  }
}

/**
 * Conflict Error (409)
 */
class ConflictError extends APIError {
  /**
   * Create a new Conflict Error
   * @param {string} message - Error message
   */
  constructor(message = 'Resource already exists') {
    super(message, StatusCodes.CONFLICT);
  }
}

/**
 * Validation Error (422)
 */
class ValidationError extends APIError {
  /**
   * Create a new Validation Error
   * @param {string} message - Error message
   * @param {object} errors - Validation errors
   */
  constructor(message = 'Validation failed', errors = {}) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY);
    this.errors = errors;
  }
}

/**
 * Too Many Requests Error (429)
 */
class TooManyRequestsError extends APIError {
  /**
   * Create a new Too Many Requests Error
   * @param {string} message - Error message
   */
  constructor(message = 'Too many requests, please try again later') {
    super(message, StatusCodes.TOO_MANY_REQUESTS);
  }
}

/**
 * Internal Server Error (500)
 */
class InternalServerError extends APIError {
  /**
   * Create a new Internal Server Error
   * @param {string} message - Error message
   */
  constructor(message = 'Internal server error') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR);
    this.isOperational = false;
  }
}

module.exports = {
  APIError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError
};
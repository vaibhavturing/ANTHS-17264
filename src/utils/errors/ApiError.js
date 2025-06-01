// src/utils/errors/ApiError.js

const BaseError = require('./BaseError');
const { StatusCodes } = require('http-status-codes');

/**
 * Generic API error
 * @extends BaseError
 */
class ApiError extends BaseError {
  /**
   * Create API error
   * @param {string} message - Error message
   * @param {number} httpCode - HTTP status code
   * @param {*} details - Error details
   * @param {string} code - Error code
   * @param {boolean} isOperational - Is this an operational error?
   */
  constructor(
    message = 'Internal server error',
    httpCode = StatusCodes.INTERNAL_SERVER_ERROR,
    details = undefined,
    code = 'API_ERROR',
    isOperational = true
  ) {
    super(
      'ApiError',
      httpCode,
      message,
      isOperational,
      code,
      details
    );
  }
  
  /**
   * Create a bad request error
   * @param {string} message - Error message
   * @param {*} details - Error details
   * @returns {ApiError}
   */
  static badRequest(message = 'Bad request', details) {
    return new ApiError(
      message,
      StatusCodes.BAD_REQUEST,
      details,
      'BAD_REQUEST',
      true
    );
  }
  
  /**
   * Create a too many requests error
   * @param {number} retryAfterSeconds - Seconds until retry is allowed
   * @returns {ApiError}
   */
  static tooManyRequests(retryAfterSeconds = 60) {
    return new ApiError(
      'Too many requests',
      StatusCodes.TOO_MANY_REQUESTS,
      { retryAfter: retryAfterSeconds },
      'TOO_MANY_REQUESTS',
      true
    );
  }
  
  /**
   * Create a service unavailable error
   * @param {string} message - Error message
   * @returns {ApiError}
   */
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new ApiError(
      message,
      StatusCodes.SERVICE_UNAVAILABLE,
      undefined,
      'SERVICE_UNAVAILABLE',
      true
    );
  }
  
  /**
   * Create an internal server error
   * @param {string} message - Error message
   * @param {*} details - Error details (only included in non-production)
   * @returns {ApiError}
   */
  static internal(message = 'Internal server error', details) {
    // Only include details in non-production environments
    const safeDetails = process.env.NODE_ENV !== 'production' ? details : undefined;
    
    return new ApiError(
      message,
      StatusCodes.INTERNAL_SERVER_ERROR,
      safeDetails,
      'INTERNAL_SERVER_ERROR',
      false // Internal errors are not operational by default
    );
  }
}

module.exports = ApiError;
// src/utils/errors/BaseError.js

/**
 * Base error class for all application errors
 * @extends Error
 */
class BaseError extends Error {
  /**
   * Create a new base error
   * @param {string} name - Error name
   * @param {string} httpCode - HTTP status code
   * @param {string} message - Error message
   * @param {boolean} isOperational - Is this an operational error?
   * @param {string|null} code - Optional error code
   * @param {*} details - Additional error details
   */
  constructor(name, httpCode, message, isOperational = true, code = null, details = undefined) {
    super(message);
    this.name = name;
    this.httpCode = httpCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert error to plain object for logging and response
   * @param {boolean} includeStack - Whether to include stack in the output
   * @returns {Object} Error as plain object
   */
  toJSON(includeStack = false) {
    const error = {
      name: this.name,
      message: this.message,
      code: this.code,
      httpCode: this.httpCode,
      isOperational: this.isOperational,
    };
    
    // Include details if available
    if (this.details !== undefined) {
      error.details = this.details;
    }
    
    // Include stack trace in non-production environments
    if (includeStack && process.env.NODE_ENV !== 'production') {
      error.stack = this.stack;
    }
    
    return error;
  }
  
  /**
   * Convert error to a client-safe response object
   * @returns {Object} Sanitized error for client response
   */
  toResponse() {
    // Basic info that's safe to return to clients
    const responseError = {
      message: this.message
    };
    
    // Include error code if available
    if (this.code) {
      responseError.code = this.code;
    }
    
    // Include details in development mode or if they're safe to share
    if (process.env.NODE_ENV === 'development' || 
        (this.details && this.isOperational)) {
      responseError.details = this.details;
    }
    
    return {
      error: responseError
    };
  }
}

module.exports = BaseError;
// src/utils/errors/ValidationError.js

const BaseError = require('./BaseError');
const { StatusCodes } = require('http-status-codes');

/**
 * Error for request validation failures
 * @extends BaseError
 */
class ValidationError extends BaseError {
  /**
   * Create validation error
   * @param {string} message - Error message
   * @param {*} details - Validation details, typically from Joi
   * @param {string|null} code - Optional error code
   */
  constructor(message = 'Validation error', details = undefined, code = 'VALIDATION_ERROR') {
    super(
      'ValidationError',
      StatusCodes.BAD_REQUEST,
      message,
      true,
      code,
      details
    );
  }
  
  /**
   * Create error from Joi validation error
   * @param {Error} joiError - Joi validation error
   * @returns {ValidationError} Formatted validation error
   */
  static fromJoiError(joiError) {
    const details = joiError.details?.map(item => ({
      message: item.message.replace(/['"]/g, ''),
      path: item.path,
      type: item.type
    }));
    
    return new ValidationError(
      'Request validation failed',
      details,
      'VALIDATION_ERROR'
    );
  }
  
  /**
   * Create error from Mongoose validation error
   * @param {Error} mongooseError - Mongoose validation error
   * @returns {ValidationError} Formatted validation error
   */
  static fromMongooseError(mongooseError) {
    const details = Object.entries(mongooseError.errors || {}).map(([field, error]) => ({
      message: error.message,
      path: field,
      type: error.kind
    }));
    
    return new ValidationError(
      'Data validation failed',
      details,
      'VALIDATION_ERROR'
    );
  }
}

module.exports = ValidationError;
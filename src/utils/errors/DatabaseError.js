// src/utils/errors/DatabaseError.js

const BaseError = require('./BaseError');
const { StatusCodes } = require('http-status-codes');

/**
 * Error for database operation failures
 * @extends BaseError
 */
class DatabaseError extends BaseError {
  /**
   * Create database error
   * @param {string} message - Error message
   * @param {*} details - Error details
   * @param {string} code - Error code
   * @param {boolean} isOperational - Is this an operational error?
   */
  constructor(
    message = 'Database operation failed',
    details = undefined,
    code = 'DATABASE_ERROR',
    isOperational = true
  ) {
    super(
      'DatabaseError',
      StatusCodes.INTERNAL_SERVER_ERROR,
      message,
      isOperational,
      code,
      details
    );
  }
  
  /**
   * Create error from MongoDB/Mongoose error
   * @param {Error} error - Original error
   * @returns {DatabaseError} Formatted database error
   */
  static fromMongoError(error) {
    // Check for specific MongoDB error codes
    if (error.code === 11000) {
      // Duplicate key error
      return new DatabaseError(
        'An item with these details already exists',
        {
          keyPattern: error.keyPattern,
          keyValue: error.keyValue
        },
        'DUPLICATE_ENTRY',
        true
      );
    }
    
    // Default database error for other cases
    return new DatabaseError(
      'Database operation failed',
      process.env.NODE_ENV === 'development' ? error.message : undefined,
      'DATABASE_ERROR',
      true
    );
  }
  
  /**
   * Resource not found error
   * @param {string} resource - Name of the resource
   * @param {string} id - ID of the resource
   * @returns {DatabaseError}
   */
  static notFound(resource, id) {
    // Use a 404 status for not found errors
    const error = new DatabaseError(
      `${resource} not found`,
      id ? { id } : undefined,
      'RESOURCE_NOT_FOUND',
      true
    );
    error.httpCode = StatusCodes.NOT_FOUND;
    return error;
  }
  
  /**
   * Error for database connection issues
   * @returns {DatabaseError}
   */
  static connectionError() {
    return new DatabaseError(
      'Database connection error',
      undefined,
      'DATABASE_CONNECTION_ERROR',
      true
    );
  }
  
  /**
   * Error for query timeout
   * @returns {DatabaseError}
   */
  static queryTimeout() {
    return new DatabaseError(
      'Database query timeout',
      undefined,
      'QUERY_TIMEOUT',
      true
    );
  }
  
  /**
   * Transaction error
   * @returns {DatabaseError}
   */
  static transactionError() {
    return new DatabaseError(
      'Database transaction failed',
      undefined,
      'TRANSACTION_FAILED',
      true
    );
  }
}

module.exports = DatabaseError;
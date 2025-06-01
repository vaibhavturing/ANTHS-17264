// src/utils/errors/NotFoundError.js

const BaseError = require('./BaseError');
const { StatusCodes } = require('http-status-codes');

/**
 * Error for resource-not-found cases
 * @extends BaseError
 */
class NotFoundError extends BaseError {
  /**
   * Create not found error
   * @param {string} message - Error message
   * @param {*} details - Error details
   * @param {string} code - Error code
   */
  constructor(
    message = 'Resource not found',
    details = undefined,
    code = 'NOT_FOUND'
  ) {
    super(
      'NotFoundError',
      StatusCodes.NOT_FOUND,
      message,
      true,
      code,
      details
    );
  }
  
  /**
   * Create error for specific resource type
   * @param {string} resourceType - Type of resource (e.g., 'patient', 'appointment')
   * @param {string} id - ID of the resource
   * @returns {NotFoundError}
   */
  static forResource(resourceType, id) {
    return new NotFoundError(
      `The requested ${resourceType} was not found`,
      { resourceId: id },
      `${resourceType.toUpperCase()}_NOT_FOUND`
    );
  }
  
  /**
   * Create route not found error
   * @param {string} path - Requested path
   * @param {string} method - HTTP method
   * @returns {NotFoundError}
   */
  static routeNotFound(path, method) {
    return new NotFoundError(
      `Route ${method} ${path} not found`,
      { path, method },
      'ROUTE_NOT_FOUND'
    );
  }
}

module.exports = NotFoundError;
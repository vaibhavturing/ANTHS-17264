/**
 * Healthcare Management Application
 * Not Found Middleware
 * 
 * Handles requests to non-existent routes
 */

const { StatusCodes } = require('http-status-codes');
const { NotFoundError } = require('../utils/api-error.util');

/**
 * Middleware to handle 404 routes
 */
module.exports = (req, res, next) => {
  const error = NotFoundError.routeNotFound(req.originalUrl, req.method);
  next(error);
};

/**
 * Handle 404 not found errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFoundMiddleware = (req, res, next) => {
  next(new NotFoundError(`Resource not found - ${req.originalUrl}`));
};

module.exports = notFoundMiddleware;
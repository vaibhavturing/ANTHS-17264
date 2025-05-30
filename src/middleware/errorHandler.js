/**
 * Healthcare Management Application
 * Global Error Handler Middleware
 */

const logger = require('../utils/logger');

/**
 * Handle Mongoose validation errors
 * @param {Error} err - Error object
 * @returns {Object} Formatted error object
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return { message, statusCode: 400 };
};

/**
 * Handle JWT errors
 * @param {Error} err - Error object
 * @returns {Object} Formatted error object
 */
const handleJWTError = () => {
  return { message: 'Invalid token. Please log in again!', statusCode: 401 };
};

/**
 * Handle JWT expired errors
 * @returns {Object} Formatted error object
 */
const handleJWTExpiredError = () => {
  return { message: 'Your token has expired! Please log in again.', statusCode: 401 };
};

/**
 * Handle duplicate key errors
 * @param {Error} err - Error object
 * @returns {Object} Formatted error object
 */
const handleDuplicateFieldsError = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return { message, statusCode: 400 };
};

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error for debugging
  logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method}`);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const validationError = handleValidationError(err);
    error.statusCode = validationError.statusCode;
    error.message = validationError.message;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const duplicateError = handleDuplicateFieldsError(err);
    error.statusCode = duplicateError.statusCode;
    error.message = duplicateError.message;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const jwtError = handleJWTError();
    error.statusCode = jwtError.statusCode;
    error.message = jwtError.message;
  }

  if (err.name === 'TokenExpiredError') {
    const tokenError = handleJWTExpiredError();
    error.statusCode = tokenError.statusCode;
    error.message = tokenError.message;
  }

  // Development vs Production error responses
  if (process.env.NODE_ENV === 'development') {
    res.status(error.statusCode).json({
      status: 'error',
      error: error,
      message: error.message,
      stack: error.stack
    });
  } else {
    // Don't leak error details in production
    if (error.isOperational) {
      res.status(error.statusCode).json({
        status: 'error',
        message: error.message
      });
    } else {
      // Programming or unknown errors
      logger.error('ERROR 💥', error);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!'
      });
    }
  }
};

module.exports = errorHandler;
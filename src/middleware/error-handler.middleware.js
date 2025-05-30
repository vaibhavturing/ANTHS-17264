/**
 * Healthcare Management Application
 * Error Handler Middleware
 * 
 * Global error handling middleware to process errors and send appropriate responses
 */

const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Handle MongoDB validation errors
 * @param {Error} err - Error object
 * @returns {Object} Formatted error object
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation failed: ${errors.join('. ')}`;
  return { 
    message, 
    statusCode: StatusCodes.BAD_REQUEST,
    errors: Object.keys(err.errors).reduce((acc, key) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {})
  };
};

/**
 * Handle JWT errors
 * @param {Error} err - Error object
 * @returns {Object} Formatted error object
 */
const handleJWTError = () => {
  return { 
    message: 'Invalid token. Please log in again!', 
    statusCode: StatusCodes.UNAUTHORIZED 
  };
};

/**
 * Handle JWT expired errors
 * @returns {Object} Formatted error object
 */
const handleJWTExpiredError = () => {
  return { 
    message: 'Your token has expired! Please log in again.', 
    statusCode: StatusCodes.UNAUTHORIZED 
  };
};

/**
 * Handle duplicate key errors
 * @param {Error} err - Error object
 * @returns {Object} Formatted error object
 */
const handleDuplicateFieldsError = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return { message, statusCode: StatusCodes.CONFLICT };
};

/**
 * Handle CastError (invalid MongoDB ObjectId)
 * @param {Error} err - Error object
 * @returns {Object} Formatted error object
 */
const handleCastError = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return { message, statusCode: StatusCodes.BAD_REQUEST };
};

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandlerMiddleware = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  error.isOperational = err.isOperational || false;
  error.errors = err.errors;

  // Log error for debugging and monitoring
  const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
  const logMessage = `${req.method} ${req.path} | ${error.statusCode} | ${error.message}`;
  const logMeta = {
    ip: req.ip,
    method: req.method,
    path: req.path,
    statusCode: error.statusCode,
    errorName: err.name,
    userId: req.user?.id || 'unauthenticated',
    stack: config.env !== 'production' ? err.stack : undefined
  };
  
  logger.log(logLevel, logMessage, logMeta);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    const validationError = handleValidationError(err);
    error.statusCode = validationError.statusCode;
    error.message = validationError.message;
    error.errors = validationError.errors;
  }

  if (err.code === 11000) {
    const duplicateError = handleDuplicateFieldsError(err);
    error.statusCode = duplicateError.statusCode;
    error.message = duplicateError.message;
  }

  if (err.name === 'CastError') {
    const castError = handleCastError(err);
    error.statusCode = castError.statusCode;
    error.message = castError.message;
  }

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

  // Handle file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error.statusCode = StatusCodes.BAD_REQUEST;
    error.message = 'File too large. Maximum size allowed is 5MB.';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error.statusCode = StatusCodes.BAD_REQUEST;
    error.message = 'Too many files uploaded or invalid field name.';
  }

  // Development vs Production error responses
  if (config.env === 'development') {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      stack: err.stack,
      error: err,
      errors: error.errors
    });
  } else {
    // Don't leak error details in production
    if (error.isOperational) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        errors: error.errors
      });
    } else {
      // Programming or unknown errors: don't leak error details
      logger.error('NON-OPERATIONAL ERROR 💥', {
        error: err,
        stack: err.stack
      });
      
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Something went wrong'
      });
    }
  }
};

module.exports = errorHandlerMiddleware;
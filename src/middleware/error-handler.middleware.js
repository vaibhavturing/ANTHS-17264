// src/middleware/error-handler.middleware.js

const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const Joi = require('joi');
const logger = require('../utils/logger');
const { 
  BaseError, 
  ValidationError, 
  DatabaseError,
  ApiError,
  NotFoundError
} = require('../utils/errors');
const config = require('../config/config');

/**
 * Global error handler middleware
 */
module.exports = (err, req, res, next) => {
  let error = err;
  
  // Log the original error with stack trace
  logError(req, error);
  
  // Convert various error types to our standardized error classes
  error = normalizeError(error);
  
  // Send response based on the error
  sendErrorResponse(res, error);
};

/**
 * Log appropriate error information
 * @param {Object} req - Express request object
 * @param {Error} error - Error object
 */
function logError(req, error) {
  // Log at appropriate level based on status code and operational status
  const logPayload = {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    body: sanitizeRequestBody(req.body),
    userId: req.user?.id
  };
  
  // Determine if this is a client error (4xx) or server error (5xx)
  const isClientError = error.httpCode && error.httpCode < 500;
  const isOperational = error instanceof BaseError && error.isOperational;
  
  if (isClientError && isOperational) {
    // Client errors that are expected operational errors (log as warning)
    logger.warn({
      message: `Client error: ${error.message}`,
      error: error instanceof BaseError ? error.toJSON(true) : error,
      request: logPayload
    });
  } else {
    // Server errors or non-operational errors (log as error)
    logger.error({
      message: `Server error: ${error.message}`,
      error: error instanceof BaseError ? error.toJSON(true) : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      request: logPayload
    });
  }
}

/**
 * Remove sensitive information from request body for logging
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
function sanitizeRequestBody(body) {
  if (!body) return undefined;
  
  // Create a copy we can modify
  const sanitized = { ...body };
  
  // List of sensitive fields to redact
  const sensitiveFields = [
    'password', 'newPassword', 'currentPassword', 'passwordConfirmation',
    'token', 'refreshToken', 'accessToken', 'authorization',
    'ssn', 'socialSecurityNumber', 'creditCard', 'cardNumber', 'cvv',
    'secret', 'privateKey'
  ];
  
  // Redact sensitive fields
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  // Recursively sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeRequestBody(value);
    }
  }
  
  return sanitized;
}

/**
 * Normalize different error types into our standard error structure
 * @param {Error} err - Original error
 * @returns {BaseError} Normalized error
 */
function normalizeError(err) {
  // If already a BaseError instance, use it directly
  if (err instanceof BaseError) {
    return err;
  }
  
  // Handle Joi validation errors
  if (err.isJoi) {
    return ValidationError.fromJoiError(err);
  }
  
  // Handle Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    return ValidationError.fromMongooseError(err);
  }
  
  // Handle Mongoose/MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return DatabaseError.fromMongoError(err);
  }
  
  // Handle Mongoose CastError (usually invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    if (err.kind === 'ObjectId') {
      return NotFoundError.forResource(
        err.model ? err.model.modelName.toLowerCase() : 'resource',
        err.value
      );
    }
    return ValidationError.fromMongooseError(err);
  }
  
  // Handle SyntaxError (usually invalid JSON)
  if (err instanceof SyntaxError && err.status === 400) {
    return ApiError.badRequest('Invalid request format');
  }
  
  // Default to internal server error
  return ApiError.internal(
    err.message || 'An unexpected error occurred',
    config.env !== 'production' ? err : undefined
  );
}

/**
 * Send appropriate error response
 * @param {Object} res - Express response object
 * @param {BaseError} error - Normalized error object
 */
function sendErrorResponse(res, error) {
  // Default to internal server error if no status code
  const statusCode = error.httpCode || StatusCodes.INTERNAL_SERVER_ERROR;
  
  // Get sanitized error for response
  const errorResponse = error.toResponse();
  
  // Add error code if available
  if (error.code) {
    errorResponse.error.code = error.code;
  }
  
  // Clean up sensitive information for security
  // Added security measure - clear any auth headers in 500 responses
  if (statusCode >= 500) {
    res.removeHeader('Authorization');
  }
  
  // In production, sanitize all 500 errors to a generic message
  if (statusCode >= 500 && config.env === 'production') {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  }
  
  // Send the error response
  res.status(statusCode).json(errorResponse);
}
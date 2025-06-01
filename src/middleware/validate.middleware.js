// src/middleware/validate.middleware.js

/**
 * Request validation middleware using Joi
 * Validates request body, query parameters, and URL parameters
 * against predefined schemas
 */

const Joi = require('joi');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Create validation middleware with specified schemas
 * 
 * @param {Object} schema - Validation schemas for different parts of the request
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware function
 */
const validate = (schema, options = {}) => {
  // Set default options
  const defaultOptions = {
    abortEarly: false, // Return all errors, not just the first one
    allowUnknown: true, // Allow unknown properties (they will be ignored)
    stripUnknown: false, // Don't remove unknown properties
    ...options
  };
  
  // Return middleware function
  return (req, res, next) => {
    // Only validate parts of the request for which schemas are provided
    const validationSchemas = {
      body: schema.body ? { schema: schema.body, value: req.body } : null,
      params: schema.params ? { schema: schema.params, value: req.params } : null,
      query: schema.query ? { schema: schema.query, value: req.query } : null,
      headers: schema.headers ? { schema: schema.headers, value: req.headers } : null
    };
    
    // Track validation errors
    const validationErrors = {};
    
    // Validate each part of the request
    for (const [part, validation] of Object.entries(validationSchemas)) {
      if (!validation) continue;
      
      const { schema, value } = validation;
      
      const { error, value: validatedValue } = schema.validate(value, defaultOptions);
      
      // If validation passed, update the request with validated values
      if (!error) {
        req[part] = validatedValue;
        continue;
      }
      
      // Collect all validation errors
      validationErrors[part] = error.details.map(detail => ({
        message: detail.message.replace(/['"]/g, ''),
        path: detail.path,
        type: detail.type
      }));
      
      // Log validation error details
      logger.debug(`Validation error in ${part}:`, { 
        errors: validationErrors[part],
        path: req.path
      });
    }
    
    // If any validation errors occurred, return them all
    if (Object.keys(validationErrors).length > 0) {
      return next(new ValidationError(
        'Request validation failed',
        { errors: validationErrors },
        'VALIDATION_ERROR'
      ));
    }
    
    // All validations passed
    return next();
  };
};

module.exports = validate;
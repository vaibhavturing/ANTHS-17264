// src/middleware/validate.middleware.js

/**
 * Middleware for request validation using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const logger = require('../utils/logger');

/**
 * Middleware for request validation using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      // CHANGE: Add support for validating query parameters and route parameters
      let dataToValidate;
      switch (source) {
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'body':
        default:
          dataToValidate = req.body;
      }
      
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false, // Return all errors, not just the first one
        stripUnknown: true, // Remove unknown keys from the validated data
        errors: { 
          wrap: { 
            label: '' // Don't wrap field names in quotes
          } 
        }
      });
      
      if (error) {
        const errorDetails = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        logger.debug('Validation error', { 
          path: req.path, 
          errors: errorDetails 
        });
        
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            type: 'VALIDATION_ERROR',
            details: errorDetails
          }
        });
      }
      
      // Update the validated data in the request
      switch (source) {
        case 'query':
          req.query = value;
          break;
        case 'params':
          req.params = value;
          break;
        case 'body':
        default:
          req.body = value;
      }
      
      next();
    } catch (error) {
      logger.error('Validation middleware error', { error: error.message });
      next(error);
    }
  };
};

module.exports = validate;
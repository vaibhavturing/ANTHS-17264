// src/middleware/validate.middleware.js

/**
 * Middleware for request validation using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validate = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
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
      
      // Replace request body with validated data
      req.body = value;
      next();
    } catch (error) {
      logger.error('Validation middleware error', { error: error.message });
      next(error);
    }
  };
};
module.exports = validate;
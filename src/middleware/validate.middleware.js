const { ResponseUtil } = require('../utils/response.util');
const logger = require('../utils/logger');

/**
 * Middleware for request validation using Joi schemas
 * @param {Object} schema - Joi validation schema
 * @returns {Function} Express middleware function
 */
const validate = (schema) => {
  return (req, res, next) => {
    if (!schema) {
      return next();
    }

    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        logger.warn('Validation error', { errors: validationErrors });
        
        return ResponseUtil.error(
          res,
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          { validationErrors }
        );
      }

      // Replace req.body with validated data
      req.body = value;
      next();
    } catch (err) {
      logger.error('Validation middleware error', { error: err.message });
      return ResponseUtil.error(
        res,
        'Validation process failed',
        500,
        'SERVER_ERROR'
      );
    }
  };
};

module.exports = validate;
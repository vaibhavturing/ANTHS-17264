const { validationResult } = require('express-validator');
const { ResponseUtil } = require('../utils/response.util');

/**
 * Middleware to validate request data using express-validator
 * @param {Array} validations - Array of validation middlewares
 * @returns {Function} Express middleware
 */
const validateRequest = (validations) => {
  return async (req, res, next) => {
    // Execute all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      // Format errors for response
      const formattedErrors = {};
      errors.array().forEach(error => {
        formattedErrors[error.param] = error.msg;
      });
      
      return ResponseUtil.error(
        res, 
        'Validation failed', 
        400, 
        'VALIDATION_ERROR', 
        { errors: formattedErrors }
      );
    }
    
    next();
  };
};

module.exports = { validateRequest };
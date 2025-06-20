// src/validators/location.validator.js
const { body, param, query, validationResult } = require('express-validator');
const { BadRequestError } = require('../utils/errors');

/**
 * Process validation errors and throw if any exist
 */
const processValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new BadRequestError(
      'Validation error',
      errors.array().map(err => ({ field: err.param, message: err.msg }))
    );
  }
  next();
};

/**
 * Validator for location operations
 */
const locationValidator = {
  /**
   * Validate get location request
   */
  validateGetLocation: [
    param('id')
      .isMongoId()
      .withMessage('Invalid location ID format'),
    processValidationErrors
  ],
  
  /**
   * Validate service parameter
   */
  validateServiceParam: [
    param('service')
      .notEmpty()
      .withMessage('Service parameter is required')
      .isString()
      .withMessage('Service must be a string')
      .trim(),
    processValidationErrors
  ],
  
  /**
   * Validate region query parameters
   */
  validateRegionQuery: [
    query('city')
      .optional()
      .isString()
      .withMessage('City must be a string')
      .trim(),
    query('state')
      .optional()
      .isString()
      .withMessage('State must be a string')
      .trim(),
    (req, res, next) => {
      // Ensure at least one of city or state is provided
      if (!req.query.city && !req.query.state) {
        throw new BadRequestError('Either city or state parameter is required');
      }
      next();
    },
    processValidationErrors
  ],
  
  /**
   * Validate create location request
   */
  validateCreateLocation: [
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .isString()
      .withMessage('Name must be a string')
      .trim(),
    body('address.street')
      .notEmpty()
      .withMessage('Street address is required')
      .isString()
      .withMessage('Street must be a string')
      .trim(),
    body('address.city')
      .notEmpty()
      .withMessage('City is required')
      .isString()
      .withMessage('City must be a string')
      .trim(),
    body('address.state')
      .notEmpty()
      .withMessage('State is required')
      .isString()
      .withMessage('State must be a string')
      .trim(),
    body('address.zipCode')
      .notEmpty()
      .withMessage('Zip code is required')
      .isString()
      .withMessage('Zip code must be a string')
      .trim(),
    body('contactInfo.phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .isString()
      .withMessage('Phone must be a string')
      .trim(),
    body('operatingHours')
      .isArray()
      .withMessage('Operating hours must be an array'),
    body('operatingHours.*.day')
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      .withMessage('Day must be a valid day of the week'),
    body('operatingHours.*.open')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Open time must be in format HH:MM (24-hour)'),
    body('operatingHours.*.close')
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Close time must be in format HH:MM (24-hour)'),
    body('services')
      .isArray()
      .withMessage('Services must be an array'),
    body('services.*')
      .isString()
      .withMessage('Each service must be a string')
      .trim(),
    body('coordinates')
      .optional()
      .isObject()
      .withMessage('Coordinates must be an object'),
    body('coordinates.latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('coordinates.longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    processValidationErrors
  ],
  
  /**
   * Validate update location request
   */
  validateUpdateLocation: [
    param('id')
      .isMongoId()
      .withMessage('Invalid location ID format'),
    body('name')
      .optional()
      .isString()
      .withMessage('Name must be a string')
      .trim(),
    body('address')
      .optional()
      .isObject()
      .withMessage('Address must be an object'),
    body('address.street')
      .optional()
      .isString()
      .withMessage('Street must be a string')
      .trim(),
    body('address.city')
      .optional()
      .isString()
      .withMessage('City must be a string')
      .trim(),
    body('address.state')
      .optional()
      .isString()
      .withMessage('State must be a string')
      .trim(),
    body('address.zipCode')
      .optional()
      .isString()
      .withMessage('Zip code must be a string')
      .trim(),
    body('contactInfo')
      .optional()
      .isObject()
      .withMessage('Contact info must be an object'),
    body('contactInfo.phone')
      .optional()
      .isString()
      .withMessage('Phone must be a string')
      .trim(),
    body('operatingHours')
      .optional()
      .isArray()
      .withMessage('Operating hours must be an array'),
    body('operatingHours.*.day')
      .optional()
      .isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
      .withMessage('Day must be a valid day of the week'),
    body('operatingHours.*.open')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Open time must be in format HH:MM (24-hour)'),
    body('operatingHours.*.close')
      .optional()
      .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Close time must be in format HH:MM (24-hour)'),
    body('services')
      .optional()
      .isArray()
      .withMessage('Services must be an array'),
    body('services.*')
      .optional()
      .isString()
      .withMessage('Each service must be a string')
      .trim(),
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    body('coordinates')
      .optional()
      .isObject()
      .withMessage('Coordinates must be an object'),
    body('coordinates.latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude must be between -90 and 90'),
    body('coordinates.longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude must be between -180 and 180'),
    processValidationErrors
  ]
};

module.exports = locationValidator;
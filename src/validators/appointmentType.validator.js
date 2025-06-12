// File: src/validators/appointmentType.validator.js
const { body, param, query } = require('express-validator');

/**
 * Validators for appointment type operations
 */
const appointmentTypeValidator = {
  // Validator for creating an appointment type
  createAppointmentType: [
    body('name')
      .notEmpty().withMessage('Name is required')
      .isString().withMessage('Name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('description')
      .optional()
      .isString().withMessage('Description must be a string')
      .trim(),
    
    body('duration')
      .isInt({ min: 5 }).withMessage('Duration must be at least 5 minutes'),
    
    body('bufferTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Buffer time must be a non-negative integer'),
    
    body('color')
      .optional()
      .isString().withMessage('Color must be a string')
      .matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color code (e.g., #3498db)'),
    
    body('preparationTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Preparation time must be a non-negative integer'),
    
    body('department')
      .optional()
      .isMongoId().withMessage('Invalid department ID format'),
    
    body('isOnlineBookable')
      .optional()
      .isBoolean().withMessage('isOnlineBookable must be a boolean'),
    
    body('specialRequirements')
      .optional()
      .isString().withMessage('Special requirements must be a string'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    
    body('requiredResources')
      .optional()
      .isArray().withMessage('Required resources must be an array'),
    
    body('requiredResources.*.resource')
      .optional()
      .isMongoId().withMessage('Invalid resource ID format'),
    
    body('requiredResources.*.quantity')
      .optional()
      .isInt({ min: 1 }).withMessage('Resource quantity must be a positive integer')
  ],
  
  // Validator for updating an appointment type
  updateAppointmentType: [
    param('typeId')
      .isMongoId().withMessage('Invalid appointment type ID format'),
    
    body('name')
      .optional()
      .isString().withMessage('Name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('description')
      .optional()
      .isString().withMessage('Description must be a string')
      .trim(),
    
    body('duration')
      .optional()
      .isInt({ min: 5 }).withMessage('Duration must be at least 5 minutes'),
    
    body('bufferTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Buffer time must be a non-negative integer'),
    
    body('color')
      .optional()
      .isString().withMessage('Color must be a string')
      .matches(/^#[0-9A-F]{6}$/i).withMessage('Color must be a valid hex color code (e.g., #3498db)'),
    
    body('preparationTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Preparation time must be a non-negative integer'),
    
    body('isOnlineBookable')
      .optional()
      .isBoolean().withMessage('isOnlineBookable must be a boolean'),
    
    body('specialRequirements')
      .optional()
      .isString().withMessage('Special requirements must be a string'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
  ],
  
  // Validator for toggling appointment type status
  toggleStatus: [
    param('typeId')
      .isMongoId().withMessage('Invalid appointment type ID format'),
    
    body('status')
      .isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
  ]
};

module.exports = { appointmentTypeValidator };
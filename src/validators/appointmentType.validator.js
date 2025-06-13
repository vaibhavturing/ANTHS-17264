const Joi = require('joi');

/**
 * Validation schemas for appointment type operations
 */
const appointmentTypeValidator = {
  /**
   * Schema for creating a new appointment type
   */
  create: Joi.object({
    name: Joi.string().required().trim().max(50)
      .messages({
        'string.empty': 'Appointment type name is required',
        'string.max': 'Appointment type name cannot exceed 50 characters'
      }),
    description: Joi.string().allow('').default('').trim().max(500)
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    duration: Joi.number().integer().min(5).max(180).required()
      .messages({
        'number.base': 'Duration must be a number',
        'number.min': 'Duration must be at least 5 minutes',
        'number.max': 'Duration cannot exceed 180 minutes',
        'number.integer': 'Duration must be a whole number'
      }),
    bufferTime: Joi.number().integer().min(0).max(60).default(0)
      .messages({
        'number.base': 'Buffer time must be a number',
        'number.min': 'Buffer time must be at least 0 minutes',
        'number.max': 'Buffer time cannot exceed 60 minutes',
        'number.integer': 'Buffer time must be a whole number'
      }),
    requirements: Joi.array().items(Joi.string().trim().max(200))
      .default([])
      .messages({
        'array.base': 'Requirements must be an array',
        'string.max': 'Each requirement cannot exceed 200 characters'
      }),
    requiresVideoLink: Joi.boolean().default(false),
    isNewPatient: Joi.boolean().default(false),
    color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/).default('#3498db')
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g., #3498db)'
      }),
    isActive: Joi.boolean().default(true),
    availableDoctors: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
      .default([])
      .messages({
        'array.base': 'Available doctors must be an array',
        'string.pattern.base': 'Invalid doctor ID format'
      })
  }),
  
  /**
   * Schema for updating an appointment type
   */
  update: Joi.object({
    name: Joi.string().trim().max(50)
      .messages({
        'string.max': 'Appointment type name cannot exceed 50 characters'
      }),
    description: Joi.string().allow('').trim().max(500)
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    duration: Joi.number().integer().min(5).max(180)
      .messages({
        'number.base': 'Duration must be a number',
        'number.min': 'Duration must be at least 5 minutes',
        'number.max': 'Duration cannot exceed 180 minutes',
        'number.integer': 'Duration must be a whole number'
      }),
    bufferTime: Joi.number().integer().min(0).max(60)
      .messages({
        'number.base': 'Buffer time must be a number',
        'number.min': 'Buffer time must be at least 0 minutes',
        'number.max': 'Buffer time cannot exceed 60 minutes',
        'number.integer': 'Buffer time must be a whole number'
      }),
    requirements: Joi.array().items(Joi.string().trim().max(200))
      .messages({
        'array.base': 'Requirements must be an array',
        'string.max': 'Each requirement cannot exceed 200 characters'
      }),
    requiresVideoLink: Joi.boolean(),
    isNewPatient: Joi.boolean(),
    color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/)
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g., #3498db)'
      }),
    isActive: Joi.boolean(),
    availableDoctors: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
      .messages({
        'array.base': 'Available doctors must be an array',
        'string.pattern.base': 'Invalid doctor ID format'
      })
  }).min(1) // At least one field must be updated
};

module.exports = appointmentTypeValidator;
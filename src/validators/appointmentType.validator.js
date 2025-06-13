const Joi = require('joi');
const { joiObjectId } = require('./common.validator');

/**
 * Validation schemas for appointment type operations
 */
const appointmentTypeValidator = {
  /**
   * Validate appointment type ID in params
   */
  idParam: Joi.object({
    id: joiObjectId.required().messages({
      'string.pattern.name': 'Invalid appointment type ID format'
    })
  }),

  /**
   * Validate doctor ID in params
   */
  doctorIdParam: Joi.object({
    doctorId: joiObjectId.required().messages({
      'string.pattern.name': 'Invalid doctor ID format'
    })
  }),

  /**
   * Validate appointment type creation
   */
  createAppointmentType: Joi.object({
    name: Joi.string().required().trim().min(2).max(100)
      .messages({
        'string.empty': 'Name is required',
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters'
      }),
    description: Joi.string().trim().allow('').max(500)
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#3498db')
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g. #3498db)'
      }),
    duration: Joi.number().integer().min(5).max(240).default(30)
      .messages({
        'number.base': 'Duration must be a number',
        'number.integer': 'Duration must be a whole number',
        'number.min': 'Duration must be at least 5 minutes',
        'number.max': 'Duration cannot exceed 240 minutes (4 hours)'
      }),
    bufferTime: Joi.number().integer().min(0).max(60).default(0)
      .messages({
        'number.base': 'Buffer time must be a number',
        'number.integer': 'Buffer time must be a whole number',
        'number.min': 'Buffer time cannot be negative',
        'number.max': 'Buffer time cannot exceed 60 minutes'
      }),
    isVirtual: Joi.boolean().default(false),
    isActive: Joi.boolean().default(true),
    preparationInstructions: Joi.string().trim().allow('').max(1000)
      .messages({
        'string.max': 'Preparation instructions cannot exceed 1000 characters'
      }),
    specialties: Joi.array().items(
      Joi.string().trim().min(2).max(100)
    ).default([]),
    doctorSettings: Joi.array().items(
      Joi.object({
        doctorId: joiObjectId.required(),
        duration: Joi.number().integer().min(5).max(240),
        bufferTime: Joi.number().integer().min(0).max(60),
        isActive: Joi.boolean(),
        preparationInstructions: Joi.string().trim().allow('').max(1000)
      })
    ).default([])
  }),

  /**
   * Validate appointment type updates
   */
  updateAppointmentType: Joi.object({
    name: Joi.string().trim().min(2).max(100)
      .messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 100 characters'
      }),
    description: Joi.string().trim().allow('').max(500)
      .messages({
        'string.max': 'Description cannot exceed 500 characters'
      }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/)
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g. #3498db)'
      }),
    duration: Joi.number().integer().min(5).max(240)
      .messages({
        'number.base': 'Duration must be a number',
        'number.integer': 'Duration must be a whole number',
        'number.min': 'Duration must be at least 5 minutes',
        'number.max': 'Duration cannot exceed 240 minutes (4 hours)'
      }),
    bufferTime: Joi.number().integer().min(0).max(60)
      .messages({
        'number.base': 'Buffer time must be a number',
        'number.integer': 'Buffer time must be a whole number',
        'number.min': 'Buffer time cannot be negative',
        'number.max': 'Buffer time cannot exceed 60 minutes'
      }),
    isVirtual: Joi.boolean(),
    isActive: Joi.boolean(),
    preparationInstructions: Joi.string().trim().allow('').max(1000)
      .messages({
        'string.max': 'Preparation instructions cannot exceed 1000 characters'
      }),
    specialties: Joi.array().items(
      Joi.string().trim().min(2).max(100)
    ),
    doctorSettings: Joi.array().items(
      Joi.object({
        doctorId: joiObjectId.required(),
        duration: Joi.number().integer().min(5).max(240),
        bufferTime: Joi.number().integer().min(0).max(60),
        isActive: Joi.boolean(),
        preparationInstructions: Joi.string().trim().allow('').max(1000)
      })
    )
  }),

  /**
   * Validate doctor-specific setting updates
   */
  updateDoctorSettings: Joi.object({
    duration: Joi.number().integer().min(5).max(240)
      .messages({
        'number.base': 'Duration must be a number',
        'number.integer': 'Duration must be a whole number',
        'number.min': 'Duration must be at least 5 minutes',
        'number.max': 'Duration cannot exceed 240 minutes (4 hours)'
      }),
    bufferTime: Joi.number().integer().min(0).max(60)
      .messages({
        'number.base': 'Buffer time must be a number',
        'number.integer': 'Buffer time must be a whole number',
        'number.min': 'Buffer time cannot be negative',
        'number.max': 'Buffer time cannot exceed 60 minutes'
      }),
    isActive: Joi.boolean(),
    preparationInstructions: Joi.string().trim().allow('').max(1000)
      .messages({
        'string.max': 'Preparation instructions cannot exceed 1000 characters'
      })
  })
};

module.exports = appointmentTypeValidator;
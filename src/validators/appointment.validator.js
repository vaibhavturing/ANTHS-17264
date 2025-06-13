const Joi = require('joi');

/**
 * Validation schemas for appointment operations
 */
const appointmentValidator = {
  /**
   * Schema for creating a new appointment
   */
  create: Joi.object({
    patient: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid patient ID format',
        'string.empty': 'Patient ID is required'
      }),
    doctor: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid doctor ID format',
        'string.empty': 'Doctor ID is required'
      }),
    appointmentType: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid appointment type ID format',
        'string.empty': 'Appointment type is required'
      }),
    startTime: Joi.date().required()
      .messages({
        'date.base': 'Start time must be a valid date',
        'any.required': 'Start time is required'
      }),
    notes: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      }),
    specialInstructions: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Special instructions cannot exceed 500 characters'
      }),
    lockId: Joi.string() // Optional lock ID for the booking flow
  }),
  
  /**
   * Schema for updating an appointment
   */
  update: Joi.object({
    patient: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid patient ID format'
      }),
    doctor: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid doctor ID format'
      }),
    appointmentType: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid appointment type ID format'
      }),
    startTime: Joi.date()
      .messages({
        'date.base': 'Start time must be a valid date'
      }),
    status: Joi.string().valid(
      'scheduled',
      'confirmed',
      'checked-in',
      'completed',
      'cancelled',
      'no-show'
    ),
    notes: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      }),
    specialInstructions: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Special instructions cannot exceed 500 characters'
      }),
    videoLink: Joi.string().allow('').max(255).uri()
      .messages({
        'string.max': 'Video link cannot exceed 255 characters',
        'string.uri': 'Video link must be a valid URL'
      })
  }).min(1), // At least one field must be updated
  
  /**
   * Schema for cancelling an appointment
   */
  cancel: Joi.object({
    reason: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Cancellation reason cannot exceed 500 characters'
      })
  }),
  
  /**
   * Schema for getting available time slots
   */
  availableSlots: Joi.object({
    doctorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid doctor ID format',
        'any.required': 'Doctor ID is required'
      }),
    date: Joi.string().required()
      .messages({
        'string.empty': 'Date is required'
      }),
    appointmentTypeId: Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid appointment type ID format'
      })
  }),
  
  /**
   * Schema for locking a time slot
   */
  lockSlot: Joi.object({
    doctorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid doctor ID format',
        'any.required': 'Doctor ID is required'
      }),
    startTime: Joi.date().required()
      .messages({
        'date.base': 'Start time must be a valid date',
        'any.required': 'Start time is required'
      }),
    endTime: Joi.date().required()
      .messages({
        'date.base': 'End time must be a valid date',
        'any.required': 'End time is required'
      }),
    lockId: Joi.string().optional() // Optional if client wants to provide their own lock ID
  }),
  
  /**
   * Schema for verifying a slot lock
   */
  verifyLock: Joi.object({
    doctorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Invalid doctor ID format',
        'any.required': 'Doctor ID is required'
      }),
    startTime: Joi.date().required()
      .messages({
        'date.base': 'Start time must be a valid date',
        'any.required': 'Start time is required'
      }),
    endTime: Joi.date().required()
      .messages({
        'date.base': 'End time must be a valid date',
        'any.required': 'End time is required'
      }),
    lockId: Joi.string().required()
      .messages({
        'any.required': 'Lock ID is required'
      })
  })
};

module.exports = appointmentValidator;
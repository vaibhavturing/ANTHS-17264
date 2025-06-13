const Joi = require('joi');
const joiObjectId = require('joi-objectid')(Joi); // <-- Add this line

/**
 * Validation schemas for emergency schedule operations
 * This is a new validator file added for emergency operations
 */
const emergencyValidator = {
  /**
   * Validate doctor ID in params
   */
  doctorIdParam: Joi.object({
    doctorId: joiObjectId().required().messages({
      'string.pattern.name': 'Invalid doctor ID format'
    })
  }),

  /**
   * Validate leave ID in params
   */
  leaveIdParam: Joi.object({
    leaveId: joiObjectId().required().messages({
      'string.pattern.name': 'Invalid leave ID format'
    })
  }),

  /**
   * Validate appointment ID in params
   */
  appointmentIdParam: Joi.object({
    appointmentId: joiObjectId().required().messages({
      'string.pattern.name': 'Invalid appointment ID format'
    })
  }),

  /**
   * Validate emergency unavailability registration
   */
  registerEmergencyUnavailability: Joi.object({
    startDate: Joi.date().required().messages({
      'date.base': 'Start date must be a valid date',
      'any.required': 'Start date is required'
    }),
    endDate: Joi.date().min(Joi.ref('startDate')).required().messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be greater than or equal to start date',
      'any.required': 'End date is required'
    }),
    reason: Joi.string().trim().min(3).max(500).required().messages({
      'string.base': 'Reason must be a string',
      'string.empty': 'Reason cannot be empty',
      'string.min': 'Reason must be at least 3 characters',
      'string.max': 'Reason cannot exceed 500 characters',
      'any.required': 'Reason is required'
    }),
    notifyPatients: Joi.boolean().default(true).messages({
      'boolean.base': 'Notify patients must be a boolean'
    }),
    suggestAlternatives: Joi.boolean().default(true).messages({
      'boolean.base': 'Suggest alternatives must be a boolean'
    })
  }),

  /**
   * Validate appointment rescheduling
   */
  rescheduleAppointment: Joi.object({
    doctorId: joiObjectId().required().messages({
      'string.pattern.name': 'Invalid doctor ID format',
      'any.required': 'Doctor ID is required'
    }),
    startTime: Joi.date().required().messages({
      'date.base': 'Start time must be a valid date',
      'any.required': 'Start time is required'
    }),
    notifyPatient: Joi.boolean().default(true).messages({
      'boolean.base': 'Notify patient must be a boolean'
    })
  }),

  /**
   * Validate appointment cancellation
   */
  cancelAppointment: Joi.object({
    notifyPatient: Joi.boolean().default(true).messages({
      'boolean.base': 'Notify patient must be a boolean'
    }),
    reason: Joi.string().trim().min(3).max(500).messages({
      'string.base': 'Reason must be a string',
      'string.min': 'Reason must be at least 3 characters',
      'string.max': 'Reason cannot exceed 500 characters'
    })
  })
};

module.exports = emergencyValidator;
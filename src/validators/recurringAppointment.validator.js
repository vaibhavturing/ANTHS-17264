const Joi = require('joi');

/**
 * Validation schemas for recurring appointment operations
 */
const recurringAppointmentValidator = {
  /**
   * Schema for creating a new recurring appointment series
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
    frequency: Joi.string().valid('weekly', 'biweekly', 'monthly', 'custom').required()
      .messages({
        'any.required': 'Frequency is required',
        'any.only': 'Frequency must be weekly, biweekly, monthly, or custom'
      }),
    customIntervalDays: Joi.number().integer().min(1).max(365)
      .when('frequency', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'number.base': 'Custom interval must be a number',
        'number.min': 'Custom interval must be at least 1 day',
        'number.max': 'Custom interval cannot exceed 365 days'
      }),
    dayOfWeek: Joi.number().integer().min(0).max(6)
      .when('frequency', {
        is: Joi.valid('weekly', 'biweekly'),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'number.base': 'Day of week must be a number',
        'number.min': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
        'number.max': 'Day of week must be between 0 (Sunday) and 6 (Saturday)'
      }),
    dayOfMonth: Joi.number().integer().min(1).max(31)
      .when('frequency', {
        is: 'monthly',
        then: Joi.optional(),
        otherwise: Joi.optional()
      })
      .messages({
        'number.base': 'Day of month must be a number',
        'number.min': 'Day of month must be between 1 and 31',
        'number.max': 'Day of month must be between 1 and 31'
      }),
    useSameDayOfWeekMonthly: Joi.boolean()
      .when('frequency', {
        is: 'monthly',
        then: Joi.optional(),
        otherwise: Joi.optional()
      })
      .default(false),
    timeOfDay: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
      .messages({
        'string.pattern.base': 'Time must be in 24-hour HH:MM format',
        'any.required': 'Time is required'
      }),
    startDate: Joi.date().required()
      .messages({
        'date.base': 'Start date must be a valid date',
        'any.required': 'Start date is required'
      }),
    endDate: Joi.date().min(Joi.ref('startDate'))
      .messages({
        'date.base': 'End date must be a valid date',
        'date.min': 'End date must be after start date'
      }),
    occurrences: Joi.number().integer().min(1).max(52)
      .messages({
        'number.base': 'Occurrences must be a number',
        'number.min': 'Must schedule at least 1 occurrence',
        'number.max': 'Cannot schedule more than 52 occurrences'
      })
      .when('endDate', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required()
      }),
    duration: Joi.number().integer().min(5).max(180).required()
      .messages({
        'number.base': 'Duration must be a number',
        'number.min': 'Duration must be at least 5 minutes',
        'number.max': 'Duration cannot exceed 180 minutes',
        'number.integer': 'Duration must be a whole number'
      }),
    notes: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      }),
    skipHolidays: Joi.boolean().default(true),
    autoReschedule: Joi.boolean().default(false),
    rescheduleWindowDays: Joi.number().integer().min(0).max(14).default(3)
      .messages({
        'number.base': 'Reschedule window must be a number',
        'number.min': 'Reschedule window cannot be negative',
        'number.max': 'Reschedule window cannot exceed 14 days'
      })
  }),
  
  /**
   * Schema for updating a recurring appointment series
   */
  update: Joi.object({
    notes: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      }),
    status: Joi.string().valid('active', 'cancelled', 'partially_cancelled')
      .messages({
        'any.only': 'Status must be active, cancelled, or partially_cancelled'
      }),
    // For 'this' update mode
    position: Joi.number().integer().min(1)
      .messages({
        'number.base': 'Position must be a number',
        'number.min': 'Position must be at least 1'
      }),
    date: Joi.date()
      .messages({
        'date.base': 'Date must be a valid date'
      }),
    // For 'thisAndFuture' update mode
    startPosition: Joi.number().integer().min(1)
      .messages({
        'number.base': 'Start position must be a number',
        'number.min': 'Start position must be at least 1'
      }),
    startDate: Joi.date()
      .messages({
        'date.base': 'Start date must be a valid date'
      })
  })
  .min(1), // At least one field must be updated
  
  /**
   * Schema for cancelling a recurring appointment series
   */
  cancel: Joi.object({
    reason: Joi.string().allow('').max(500)
      .messages({
        'string.max': 'Cancellation reason cannot exceed 500 characters'
      }),
    startDate: Joi.date()
      .messages({
        'date.base': 'Start date must be a valid date'
      })
  })
};

module.exports = recurringAppointmentValidator;
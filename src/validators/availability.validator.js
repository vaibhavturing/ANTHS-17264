const Joi = require('joi');
const { joiObjectId } = require('./common.validator');

/**
 * Validation schemas for availability operations
 */
const availabilityValidator = {
  /**
   * Validate doctor ID in params
   */
  doctorIdParam: Joi.object({
    doctorId: joiObjectId.required().messages({
      'string.pattern.name': 'Invalid doctor ID format'
    })
  }),

  /**
   * Validate leave ID in params
   */
  leaveIdParam: Joi.object({
    leaveId: joiObjectId.required().messages({
      'string.pattern.name': 'Invalid leave ID format'
    })
  }),

  /**
   * Validate break time ID in params
   */
  breakTimeIdParam: Joi.object({
    breakTimeId: joiObjectId.required().messages({
      'string.pattern.name': 'Invalid break time ID format'
    })
  }),

  /**
   * Validate special date ID in params
   */
  specialDateIdParam: Joi.object({
    specialDateId: joiObjectId.required().messages({
      'string.pattern.name': 'Invalid special date ID format'
    })
  }),

  /**
   * Validate working hours update
   */
  updateWorkingHours: Joi.object({
    workingHours: Joi.array().items(
      Joi.object({
        dayOfWeek: Joi.number().integer().min(0).max(6).required()
          .messages({
            'number.base': 'Day of week must be a number',
            'number.integer': 'Day of week must be an integer',
            'number.min': 'Day of week must be between 0 and 6',
            'number.max': 'Day of week must be between 0 and 6',
            'any.required': 'Day of week is required'
          }),
        isWorking: Joi.boolean().required()
          .messages({
            'boolean.base': 'Is working must be a boolean',
            'any.required': 'Is working is required'
          }),
        startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .when('isWorking', {
            is: true,
            then: Joi.required()
          })
          .messages({
            'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)',
            'any.required': 'Start time is required for working days'
          }),
        endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
          .when('isWorking', {
            is: true,
            then: Joi.required()
          })
          .messages({
            'string.pattern.base': 'End time must be in 24-hour format (HH:MM)',
            'any.required': 'End time is required for working days'
          })
      })
    ).length(7).required()
      .messages({
        'array.length': 'Working hours must include all 7 days of the week',
        'any.required': 'Working hours are required'
      })
  }),

  /**
   * Validate special date creation/update
   */
  addSpecialDate: Joi.object({
    date: Joi.date().required()
      .messages({
        'date.base': 'Date must be valid',
        'any.required': 'Date is required'
      }),
    isWorking: Joi.boolean().required()
      .messages({
        'boolean.base': 'Is working must be a boolean',
        'any.required': 'Is working is required'
      }),
    startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .when('isWorking', {
        is: true,
        then: Joi.required()
      })
      .messages({
        'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)',
        'any.required': 'Start time is required for working special dates'
      }),
    endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .when('isWorking', {
        is: true,
        then: Joi.required()
      })
      .messages({
        'string.pattern.base': 'End time must be in 24-hour format (HH:MM)',
        'any.required': 'End time is required for working special dates'
      }),
    title: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.base': 'Title must be a string',
        'string.empty': 'Title cannot be empty',
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 100 characters',
        'any.required': 'Title is required'
      }),
    description: Joi.string().trim().allow('').max(500)
      .messages({
        'string.base': 'Description must be a string',
        'string.max': 'Description cannot exceed 500 characters'
      }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#3498db')
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g. #3498db)'
      })
  }),

  /**
   * Validate leave creation
   */
  createLeave: Joi.object({
    title: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.base': 'Title must be a string',
        'string.empty': 'Title cannot be empty',
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 100 characters',
        'any.required': 'Title is required'
      }),
    type: Joi.string().valid('vacation', 'sick', 'personal', 'professional', 'other').default('vacation')
      .messages({
        'string.base': 'Type must be a string',
        'any.only': 'Type must be one of: vacation, sick, personal, professional, other'
      }),
    description: Joi.string().trim().allow('').max(500)
      .messages({
        'string.base': 'Description must be a string',
        'string.max': 'Description cannot exceed 500 characters'
      }),
    startDate: Joi.date().required()
      .messages({
        'date.base': 'Start date must be valid',
        'any.required': 'Start date is required'
      }),
    endDate: Joi.date().min(Joi.ref('startDate')).required()
      .messages({
        'date.base': 'End date must be valid',
        'date.min': 'End date must be greater than or equal to start date',
        'any.required': 'End date is required'
      }),
    allDay: Joi.boolean().default(true)
      .messages({
        'boolean.base': 'All day must be a boolean'
      }),
    startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .when('allDay', {
        is: false,
        then: Joi.required()
      })
      .messages({
        'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)',
        'any.required': 'Start time is required for partial day leave'
      }),
    endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .when('allDay', {
        is: false,
        then: Joi.required()
      })
      .messages({
        'string.pattern.base': 'End time must be in 24-hour format (HH:MM)',
        'any.required': 'End time is required for partial day leave'
      }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#e74c3c')
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g. #e74c3c)'
      })
  }),

  /**
   * Validate leave update
   */
  updateLeave: Joi.object({
    title: Joi.string().trim().min(2).max(100)
      .messages({
        'string.base': 'Title must be a string',
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 100 characters'
      }),
    type: Joi.string().valid('vacation', 'sick', 'personal', 'professional', 'other')
      .messages({
        'string.base': 'Type must be a string',
        'any.only': 'Type must be one of: vacation, sick, personal, professional, other'
      }),
    description: Joi.string().trim().allow('').max(500)
      .messages({
        'string.base': 'Description must be a string',
        'string.max': 'Description cannot exceed 500 characters'
      }),
    startDate: Joi.date()
      .messages({
        'date.base': 'Start date must be valid'
      }),
    endDate: Joi.date().min(Joi.ref('startDate'))
      .messages({
        'date.base': 'End date must be valid',
        'date.min': 'End date must be greater than or equal to start date'
      }),
    allDay: Joi.boolean()
      .messages({
        'boolean.base': 'All day must be a boolean'
      }),
    startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .messages({
        'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)'
      }),
    endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .messages({
        'string.pattern.base': 'End time must be in 24-hour format (HH:MM)'
      }),
    status: Joi.string().valid('pending', 'approved', 'rejected', 'cancelled')
      .messages({
        'string.base': 'Status must be a string',
        'any.only': 'Status must be one of: pending, approved, rejected, cancelled'
      }),
    rejectionReason: Joi.string().trim().max(500)
      .when('status', {
        is: 'rejected',
        then: Joi.required()
      })
      .messages({
        'string.base': 'Rejection reason must be a string',
        'string.max': 'Rejection reason cannot exceed 500 characters',
        'any.required': 'Rejection reason is required when status is rejected'
      }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/)
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g. #e74c3c)'
      })
  }),

  /**
   * Validate break time creation
   */
  createBreakTime: Joi.object({
    title: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.base': 'Title must be a string',
        'string.empty': 'Title cannot be empty',
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 100 characters',
        'any.required': 'Title is required'
      }),
    description: Joi.string().trim().allow('').max(500)
      .messages({
        'string.base': 'Description must be a string',
        'string.max': 'Description cannot exceed 500 characters'
      }),
    dayOfWeek: Joi.number().integer().min(0).max(6).required()
      .messages({
        'number.base': 'Day of week must be a number',
        'number.integer': 'Day of week must be an integer',
        'number.min': 'Day of week must be between 0 and 6',
        'number.max': 'Day of week must be between 0 and 6',
        'any.required': 'Day of week is required'
      }),
    startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required()
      .messages({
        'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)',
        'any.required': 'Start time is required'
      }),
    endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).required()
      .messages({
        'string.pattern.base': 'End time must be in 24-hour format (HH:MM)',
        'any.required': 'End time is required'
      }),
    isActive: Joi.boolean().default(true)
      .messages({
        'boolean.base': 'Is active must be a boolean'
      }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#f39c12')
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g. #f39c12)'
      }),
    effectiveFrom: Joi.date()
      .messages({
        'date.base': 'Effective from must be a valid date'
      }),
    effectiveTo: Joi.date().min(Joi.ref('effectiveFrom'))
      .messages({
        'date.base': 'Effective to must be a valid date',
        'date.min': 'Effective to must be greater than or equal to effective from'
      })
  }),

  /**
   * Validate break time update
   */
  updateBreakTime: Joi.object({
    title: Joi.string().trim().min(2).max(100)
      .messages({
        'string.base': 'Title must be a string',
        'string.min': 'Title must be at least 2 characters',
        'string.max': 'Title cannot exceed 100 characters'
      }),
    description: Joi.string().trim().allow('').max(500)
      .messages({
        'string.base': 'Description must be a string',
        'string.max': 'Description cannot exceed 500 characters'
      }),
    dayOfWeek: Joi.number().integer().min(0).max(6)
      .messages({
        'number.base': 'Day of week must be a number',
        'number.integer': 'Day of week must be an integer',
        'number.min': 'Day of week must be between 0 and 6',
        'number.max': 'Day of week must be between 0 and 6'
      }),
    startTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .messages({
        'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)'
      }),
    endTime: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .messages({
        'string.pattern.base': 'End time must be in 24-hour format (HH:MM)'
      }),
    isActive: Joi.boolean()
      .messages({
        'boolean.base': 'Is active must be a boolean'
      }),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/)
      .messages({
        'string.pattern.base': 'Color must be a valid hex color code (e.g. #f39c12)'
      }),
    effectiveFrom: Joi.date()
      .messages({
        'date.base': 'Effective from must be a valid date'
      }),
    effectiveTo: Joi.date().min(Joi.ref('effectiveFrom'))
      .messages({
        'date.base': 'Effective to must be a valid date',
        'date.min': 'Effective to must be greater than or equal to effective from'
      })
  })
};

module.exports = availabilityValidator;
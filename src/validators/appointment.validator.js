// src/validators/appointment.validator.js
const Joi = require('joi');

const appointmentValidator = {
  createAppointment: Joi.object({
    patientId: Joi.string().required().messages({
      'string.empty': 'Patient ID is required',
      'any.required': 'Patient ID is required'
    }),
    doctorId: Joi.string().required().messages({
      'string.empty': 'Doctor ID is required',
      'any.required': 'Doctor ID is required'
    }),
    startTime: Joi.date().iso().required().messages({
      'date.base': 'Start time must be a valid date',
      'date.format': 'Start time must be in ISO format',
      'any.required': 'Start time is required'
    }),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required().messages({
      'date.base': 'End time must be a valid date',
      'date.format': 'End time must be in ISO format',
      'date.greater': 'End time must be after start time',
      'any.required': 'End time is required'
    }),
    type: Joi.string().valid('new_patient', 'follow_up', 'specialist', 'urgent', 'routine').required().messages({
      'string.empty': 'Appointment type is required',
      'any.only': 'Appointment type must be one of: new_patient, follow_up, specialist, urgent, routine',
      'any.required': 'Appointment type is required'
    }),
    reason: Joi.string().required().min(5).max(500).messages({
      'string.empty': 'Reason for appointment is required',
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason cannot exceed 500 characters',
      'any.required': 'Reason for appointment is required'
    }),
    notes: Joi.string().max(1000).allow('').messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    }),
    selfScheduled: Joi.boolean().default(false),
    notifyPatient: Joi.boolean().default(true)
  }),
  
  rescheduleAppointment: Joi.object({
    startTime: Joi.date().iso().messages({
      'date.base': 'Start time must be a valid date',
      'date.format': 'Start time must be in ISO format'
    }),
    endTime: Joi.date().iso().when('startTime', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('startTime')).required().messages({
        'date.greater': 'End time must be after start time',
        'any.required': 'End time is required when start time is provided'
      })
    }).messages({
      'date.base': 'End time must be a valid date',
      'date.format': 'End time must be in ISO format'
    }),
    doctorId: Joi.string(),
    reason: Joi.string().min(5).max(500).messages({
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason cannot exceed 500 characters'
    }),
    type: Joi.string().valid('new_patient', 'follow_up', 'specialist', 'urgent', 'routine').messages({
      'any.only': 'Appointment type must be one of: new_patient, follow_up, specialist, urgent, routine'
    }),
    notes: Joi.string().max(1000).allow('').messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
  }),
  
  cancellationData: Joi.object({
    reason: Joi.string().min(5).max(500).messages({
      'string.min': 'Cancellation reason must be at least 5 characters',
      'string.max': 'Cancellation reason cannot exceed 500 characters'
    }),
    cancelledBy: Joi.string().valid('patient', 'doctor', 'staff').default('patient').messages({
      'any.only': 'Cancelled by must be one of: patient, doctor, staff'
    })
  }),
  
  completionData: Joi.object({
    notes: Joi.string().max(1000).allow('').messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    }),
    followUp: Joi.object({
      timeframe: Joi.string().valid('1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year').required().messages({
        'any.only': 'Follow-up timeframe must be one of: 1_week, 2_weeks, 1_month, 3_months, 6_months, 1_year',
        'any.required': 'Timeframe is required for follow-up'
      })
    })
  }),
  
  schedulingPreferences: Joi.object({
    preferredDoctors: Joi.array().items(Joi.string()).messages({
      'array.base': 'Preferred doctors must be an array'
    }),
    preferredTimeSlots: Joi.array().items(
      Joi.object({
        dayOfWeek: Joi.string()
          .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
          .required()
          .messages({
            'any.only': 'Day of week must be one of: monday, tuesday, wednesday, thursday, friday, saturday, sunday',
            'any.required': 'Day of week is required'
          }),
        startTime: Joi.string()
          .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
          .required()
          .messages({
            'string.pattern.base': 'Start time must be in HH:MM format (24-hour)',
            'any.required': 'Start time is required'
          }),
        endTime: Joi.string()
          .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
          .required()
          .messages({
            'string.pattern.base': 'End time must be in HH:MM format (24-hour)',
            'any.required': 'End time is required'
          })
      })
    ).messages({
      'array.base': 'Preferred time slots must be an array'
    }),
    communicationPreferences: Joi.object({
      appointmentReminders: Joi.object({
        email: Joi.boolean(),
        sms: Joi.boolean(),
        push: Joi.boolean()
      }),
      marketingCommunications: Joi.object({
        email: Joi.boolean(),
        sms: Joi.boolean()
      }),
      preferredLanguage: Joi.string()
    })
  })
};

module.exports = appointmentValidator;
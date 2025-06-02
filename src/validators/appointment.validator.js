// src/validators/appointment.validator.js

/**
 * Validation schemas for appointment-related requests
 * Covers appointment creation, updates, scheduling, check-ins, etc.
 */

const { 
  Joi, 
  objectId, 
  pagination
} = require('./common.validator');

// Create appointment validation schema
const createAppointmentSchema = {
  body: Joi.object({
    patient: objectId,
    doctor: objectId,
    appointmentType: Joi.string().valid(
      'consultation', 'check-up', 'follow-up', 'emergency', 
      'procedure', 'test', 'vaccination', 'physical-therapy', 'other'
    ).required(),
    
    date: Joi.date().greater('now').required()
      .messages({ 'date.greater': 'Appointment date must be in the future' }),
    
    startTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required()
      .messages({ 'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)' }),
      
    endTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .required()
      .messages({ 'string.pattern.base': 'End time must be in 24-hour format (HH:MM)' }),
    
    status: Joi.string().valid(
      'scheduled', 'confirmed', 'checked-in', 'in-progress', 
      'completed', 'cancelled', 'no-show', 'rescheduled'
    ).default('scheduled'),
    
    reason: Joi.string().max(500).required(),
    notes: Joi.string().max(1000).optional(),
    
    location: Joi.object({
      name: Joi.string().required(),
      address: Joi.string().required(),
      roomNumber: Joi.string().optional()
    }).required(),
    
    isTelehealth: Joi.boolean().default(false),
    
    telehealthLink: Joi.string().uri()
      .when('isTelehealth', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({ 'any.required': 'Telehealth link is required for virtual appointments' }),
    
    preAppointmentInstructions: Joi.string().optional(),
    isInsuranceVerified: Joi.boolean().default(false),
    
    isRecurring: Joi.boolean().default(false),
    recurringPattern: Joi.object({
      frequency: Joi.string().valid('daily', 'weekly', 'monthly').required(),
      interval: Joi.number().integer().min(1).required(),
      endDate: Joi.date().min(Joi.ref('...date')).required(),
      daysOfWeek: Joi.array().items(
        Joi.number().integer().min(0).max(6)
      ).when('frequency', {
        is: 'weekly',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      dayOfMonth: Joi.number().integer().min(1).max(31).when('frequency', {
        is: 'monthly',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    }).when('isRecurring', {
      is: true, 
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
  .custom((value, helpers) => {
    const startMinutes = convertTimeStringToMinutes(value.startTime);
    const endMinutes = convertTimeStringToMinutes(value.endTime);
    
    if (startMinutes >= endMinutes) {
      return helpers.message('End time must be after start time');
    }

    if ((endMinutes - startMinutes) > 480) {
      return helpers.message('Appointment duration cannot exceed 8 hours');
    }
    
    return value;
  })
};

const updateAppointmentSchema = {
  params: Joi.object({
    appointmentId: objectId
  }),
  body: Joi.object({
    doctor: objectId,
    appointmentType: Joi.string().valid(
      'consultation', 'check-up', 'follow-up', 'emergency', 
      'procedure', 'test', 'vaccination', 'physical-therapy', 'other'
    ).optional(),
    
    date: Joi.date().greater('now').optional()
      .messages({ 'date.greater': 'Appointment date must be in the future' }),
    
    startTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({ 'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)' }),
      
    endTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({ 'string.pattern.base': 'End time must be in 24-hour format (HH:MM)' }),
    
    status: Joi.string().valid(
      'scheduled', 'confirmed', 'checked-in', 'in-progress', 
      'completed', 'cancelled', 'no-show', 'rescheduled'
    ).optional(),
    
    reason: Joi.string().max(500).optional(),
    notes: Joi.string().max(1000).optional(),
    cancellationReason: Joi.string().max(500).when('status', {
      is: 'cancelled',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    
    location: Joi.object({
      name: Joi.string().required(),
      address: Joi.string().required(),
      roomNumber: Joi.string().optional()
    }).optional(),
    
    isTelehealth: Joi.boolean().optional(),
    telehealthLink: Joi.string().uri().optional(),
    
    preAppointmentInstructions: Joi.string().optional(),
    isInsuranceVerified: Joi.boolean().optional(),
  })
  .min(1)
  .message('At least one field must be provided for update')
  .custom((value, helpers) => {
    if (value.startTime && value.endTime) {
      const startMinutes = convertTimeStringToMinutes(value.startTime);
      const endMinutes = convertTimeStringToMinutes(value.endTime);
      
      if (startMinutes >= endMinutes) {
        return helpers.message('End time must be after start time');
      }

      if ((endMinutes - startMinutes) > 480) {
        return helpers.message('Appointment duration cannot exceed 8 hours');
      }
    }
    
    return value;
  })
};

const getAppointmentByIdSchema = {
  params: Joi.object({
    appointmentId: objectId
  })
};

const deleteAppointmentSchema = {
  params: Joi.object({
    appointmentId: objectId
  }),
  body: Joi.object({
    cancellationReason: Joi.string().max(500).required()
  })
};

const getAppointmentsSchema = {
  query: Joi.object({
    ...pagination,
    patient: objectId,
    doctor: objectId,
    status: Joi.string().valid(
      'scheduled', 'confirmed', 'checked-in', 'in-progress', 
      'completed', 'cancelled', 'no-show', 'rescheduled', 'all'
    ).optional(),
    appointmentType: Joi.string().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().min(Joi.ref('startDate')).optional().messages({
      'date.min': 'End date must be after start date'
    }),
    isTelehealth: Joi.boolean().optional(),
    location: Joi.string().optional()
  })
  .custom((value, helpers) => {
    if (value.endDate && !value.startDate) {
      return helpers.message('Start date is required when end date is provided');
    }
    return value;
  })
};

const checkInAppointmentSchema = {
  params: Joi.object({
    appointmentId: objectId
  }),
  body: Joi.object({
    checkInNotes: Joi.string().max(1000).optional(),
    vitalSigns: Joi.object({
      temperature: Joi.number().min(90).max(110).optional(),
      heartRate: Joi.number().min(30).max(200).optional(),
      bloodPressure: Joi.object({
        systolic: Joi.number().min(50).max(250).required(),
        diastolic: Joi.number().min(30).max(150).required()
      }).optional(),
      respiratoryRate: Joi.number().min(5).max(40).optional(),
      oxygenSaturation: Joi.number().min(50).max(100).optional(),
      height: Joi.number().min(0).optional(),
      weight: Joi.number().min(0).optional()
    }).optional(),
    arrivalTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .default(() => {
        const now = new Date();
        return `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
      })
  })
};

const updateAppointmentStatusSchema = {
  params: Joi.object({
    appointmentId: objectId
  }),
  body: Joi.object({
    status: Joi.string().valid(
      'scheduled', 'confirmed', 'checked-in', 'in-progress',
      'completed', 'cancelled', 'no-show', 'rescheduled'
    ).required(),
    cancellationReason: Joi.string().max(500).when('status', {
      is: 'cancelled',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};


const completeAppointmentSchema = {
  params: Joi.object({
    appointmentId: objectId
  }),
  body: Joi.object({
    summaryNotes: Joi.string().max(5000).required(),
    diagnosis: Joi.array().items(
      Joi.object({
        code: Joi.string().required(),
        description: Joi.string().required(),
        type: Joi.string().valid('primary', 'secondary').required()
      })
    ).min(1).required(),
    followUpNeeded: Joi.boolean().required(),
    followUpDetails: Joi.object({
      timeframe: Joi.string().valid('1-week', '2-weeks', '1-month', '3-months', '6-months', 'custom').when('...followUpNeeded', {
        is: true,
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      customTimeframe: Joi.string().when('timeframe', {
        is: 'custom',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      notes: Joi.string().max(1000).optional()
    }).when('followUpNeeded', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    medications: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        dosage: Joi.string().required(),
        frequency: Joi.string().required(),
        duration: Joi.string().required(),
        instructions: Joi.string().optional(),
        refills: Joi.number().min(0).optional()
      })
    ).optional(),
    procedures: Joi.array().items(
      Joi.object({
        code: Joi.string().required(),
        description: Joi.string().required(),
        notes: Joi.string().optional()
      })
    ).optional(),
    labOrders: Joi.array().items(
      Joi.object({
        testName: Joi.string().required(),
        urgency: Joi.string().valid('routine', 'urgent', 'stat').required(),
        instructions: Joi.string().optional()
      })
    ).optional(),
    duration: Joi.number().integer().min(1).required().description('Appointment duration in minutes')
  })
};

function convertTimeStringToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

module.exports = {
  createAppointmentSchema,
  updateAppointmentSchema,
  getAppointmentByIdSchema,
  deleteAppointmentSchema,
  getAppointmentsSchema,
  checkInAppointmentSchema,
  completeAppointmentSchema,
  updateAppointmentStatusSchema 

};

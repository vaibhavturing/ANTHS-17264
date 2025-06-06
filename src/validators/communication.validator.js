// src/validators/communication.validator.js

const Joi = require('joi');
const { 
  COMMUNICATION_TYPES, 
  COMMUNICATION_CHANNELS 
} = require('../models/communication.model');

// Schema for creating a new communication
const createCommunicationSchema = Joi.object({
  patient: Joi.string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Patient ID must be a valid MongoDB ObjectId',
      'any.required': 'Patient ID is required'
    }),
  
  type: Joi.string()
    .valid(...Object.values(COMMUNICATION_TYPES))
    .required()
    .messages({
      'any.only': 'Type must be a valid communication type',
      'any.required': 'Communication type is required'
    }),
  
  subject: Joi.string()
    .min(3)
    .max(100)
    .required()
    .messages({
      'string.min': 'Subject must be at least {#limit} characters',
      'string.max': 'Subject cannot exceed {#limit} characters',
      'any.required': 'Subject is required'
    }),
  
  body: Joi.string()
    .min(5)
    .max(5000)
    .required()
    .messages({
      'string.min': 'Body must be at least {#limit} characters',
      'string.max': 'Body cannot exceed {#limit} characters',
      'any.required': 'Body content is required'
    }),
  
  priority: Joi.string()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium'),
  
  channels: Joi.array()
    .items(Joi.string().valid(...Object.values(COMMUNICATION_CHANNELS)))
    .default([COMMUNICATION_CHANNELS.EMAIL, COMMUNICATION_CHANNELS.IN_APP]),
  
  scheduledFor: Joi.date()
    .min('now')
    .messages({
      'date.min': 'Scheduled time must be in the future'
    }),
  
  expiresAt: Joi.date()
    .greater(Joi.ref('scheduledFor'))
    .messages({
      'date.greater': 'Expiration date must be after the scheduled date'
    }),
  
  relatedTo: Joi.object({
    model: Joi.string()
      .valid('Appointment', 'MedicalRecord', 'Prescription')
      .required(),
    id: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Related ID must be a valid MongoDB ObjectId'
      })
  }),
  
  metadata: Joi.object().default({})
});

// Schema for updating communication preferences
const updateCommunicationPreferencesSchema = Joi.object({
  channelPreferences: Joi.object({
    appointment_reminder: Joi.object({
      channels: Joi.array().items(
        Joi.string().valid(...Object.values(COMMUNICATION_CHANNELS))
      ),
      enabled: Joi.boolean(),
      advanceNotice: Joi.number().integer().min(1).max(72)
    }),
    
    test_result: Joi.object({
      channels: Joi.array().items(
        Joi.string().valid(...Object.values(COMMUNICATION_CHANNELS))
      ),
      enabled: Joi.boolean()
    }),
    
    prescription_refill: Joi.object({
      channels: Joi.array().items(
        Joi.string().valid(...Object.values(COMMUNICATION_CHANNELS))
      ),
      enabled: Joi.boolean(),
      refillReminder: Joi.number().integer().min(1).max(30)
    }),
    
    health_tip: Joi.object({
      channels: Joi.array().items(
        Joi.string().valid(...Object.values(COMMUNICATION_CHANNELS))
      ),
      enabled: Joi.boolean(),
      frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly')
    }),
    
    emergency: Joi.object({
      channels: Joi.array().items(
        Joi.string().valid(...Object.values(COMMUNICATION_CHANNELS))
      ),
      enabled: Joi.boolean()
    }),
    
    general: Joi.object({
      channels: Joi.array().items(
        Joi.string().valid(...Object.values(COMMUNICATION_CHANNELS))
      ),
      enabled: Joi.boolean()
    })
  }),
  
  doNotDisturb: Joi.object({
    enabled: Joi.boolean(),
    startTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .messages({
        'string.pattern.base': 'Start time must be in 24-hour format (HH:MM)'
      }),
    endTime: Joi.string()
      .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .messages({
        'string.pattern.base': 'End time must be in 24-hour format (HH:MM)'
      }),
    overrideForEmergencies: Joi.boolean()
  }),
  
  contactInfo: Joi.object({
    email: Joi.object({
      address: Joi.string().email(),
      verified: Joi.boolean()
    }),
    phone: Joi.object({
      number: Joi.string()
        .pattern(/^\+?[1-9]\d{1,14}$/)
        .messages({
          'string.pattern.base': 'Phone number must be in E.164 format'
        }),
      verified: Joi.boolean()
    })
  }),
  
  optOut: Joi.object({
    allCommunications: Joi.boolean(),
    marketing: Joi.boolean()
  })
});

// Schema for notification queries
const notificationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  includeRead: Joi.boolean().default(false),
  type: Joi.string().valid(...Object.values(COMMUNICATION_TYPES)),
  startDate: Joi.date(),
  endDate: Joi.date().min(Joi.ref('startDate'))
});

// Schema for creating health tip
const healthTipSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  content: Joi.string().min(10).max(2000).required(),
  category: Joi.string().required(),
  source: Joi.string()
});

// Schema for creating emergency notification
const emergencyNotificationSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  message: Joi.string().min(10).max(2000).required(),
  type: Joi.string().required(),
  actionRequired: Joi.string(),
  contactNumber: Joi.string()
});

// Export all schemas
module.exports = {
  createCommunicationSchema,
  updateCommunicationPreferencesSchema,
  notificationQuerySchema,
  healthTipSchema,
  emergencyNotificationSchema
};
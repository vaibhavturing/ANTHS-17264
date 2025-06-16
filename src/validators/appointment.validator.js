const Joi = require('joi');
// Correct path to custom.validator.js
const customValidator = require('../validators/custom.validator');

const appointmentValidator = {
  // Create appointment validation schema
  createAppointment: Joi.object({
    patient: Joi.custom(customValidator.objectId).required(),
    doctor: Joi.custom(customValidator.objectId).required(),
    startTime: Joi.date().required(),
    endTime: Joi.date().greater(Joi.ref('startTime')).required(),
    appointmentType: Joi.custom(customValidator.objectId).required(),
    notes: Joi.string().allow('', null),
    cancellationRule: Joi.string().valid('24h', '48h', '72h', 'custom', 'none').default('24h'),
    customCancellationHours: Joi.number().min(1).max(168).when('cancellationRule', {
      is: 'custom',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }),

  // Get appointments with filters validation schema
  getAppointments: Joi.object({
    doctorId: Joi.custom(customValidator.objectId),
    patientId: Joi.custom(customValidator.objectId),
    startDate: Joi.date(),
    endDate: Joi.date().min(Joi.ref('startDate')),
    status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  }),

  // Update appointment validation schema
  updateAppointment: Joi.object({
    status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show'),
    notes: Joi.string().allow('', null),
    patient: Joi.custom(customValidator.objectId),
    doctor: Joi.custom(customValidator.objectId),
    startTime: Joi.date(),
    endTime: Joi.date().greater(Joi.ref('startTime')),
    appointmentType: Joi.custom(customValidator.objectId)
  }).min(1),

  // Reschedule appointment validation schema
  rescheduleAppointment: Joi.object({
    startTime: Joi.date().required(),
    endTime: Joi.date().greater(Joi.ref('startTime')).required(),
    reason: Joi.string().required(),
    checkWaitlist: Joi.boolean().default(true)
  }),

  // Force reschedule appointment validation schema (admin only)
  forceRescheduleAppointment: Joi.object({
    startTime: Joi.date().required(),
    endTime: Joi.date().greater(Joi.ref('startTime')).required(),
    reason: Joi.string().required(),
    notifyPatient: Joi.boolean().default(true),
    checkWaitlist: Joi.boolean().default(true)
  }),

  // Cancel appointment validation schema
  cancelAppointment: Joi.object({
    reason: Joi.string().required(),
    checkWaitlist: Joi.boolean().default(true),
    forceCancel: Joi.boolean().default(false)
  }),

  // Set cancellation rules validation schema
  setCancellationRules: Joi.object({
    defaultRule: Joi.string().valid('24h', '48h', '72h', 'custom', 'none').required(),
    customHours: Joi.number().min(1).max(168).when('defaultRule', {
      is: 'custom',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};

module.exports = appointmentValidator;
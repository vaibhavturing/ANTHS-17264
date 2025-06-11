// src/controllers/communication.controller.js

const communicationService = require('../services/communication.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { ValidationError } = require('../utils/errors');
const {
  createCommunicationSchema,
  updateCommunicationPreferencesSchema,
  healthTipSchema,
  emergencyNotificationSchema
} = require('../validators/communication.validator');
const logger = require('../utils/logger');

/**
 * Communication Controller
 * Handles HTTP requests related to the patient communication system
 */
const communicationController = {
  /**
   * Create a new communication
   * @route POST /api/communications
   */
  createCommunication: asyncHandler(async (req, res) => {
    const { error, value } = createCommunicationSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid communication data', error.details);
    }
    const communication = await communicationService.createCommunication(value);
    return ResponseUtil.success(res, { 
      communication,
      message: 'Communication created and queued for delivery'
    }, 201);
  }),

  /**
   * Get patient communication preferences
   * @route GET /api/patients/:patientId/communications/preferences
   */
  getPatientCommunicationPreferences: asyncHandler(async (req, res) => {
    const patientId = req.params.patientId;
    let preferences = await communicationService.getPatientCommunicationPreferences(patientId);
    if (!preferences) {
      preferences = await communicationService.createDefaultPreferences(patientId);
    }
    return ResponseUtil.success(res, { preferences });
  }),

  /**
   * Update patient communication preferences
   * @route PUT /api/patients/:patientId/communications/preferences
   */
  updatePatientCommunicationPreferences: asyncHandler(async (req, res) => {
    const { error, value } = updateCommunicationPreferencesSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid preference data', error.details);
    }
    const patientId = req.params.patientId;
    const preferences = await communicationService.updateCommunicationPreferences(
      patientId, 
      value
    );
    return ResponseUtil.success(res, { 
      preferences,
      message: 'Communication preferences updated successfully'
    });
  }),

  /**
   * Get patient communications
   * @route GET /api/patients/:patientId/communications
   */
  getPatientCommunications: asyncHandler(async (req, res) => {
    const patientId = req.params.patientId;
    const filters = {
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sort: req.query.sort || '-createdAt'
    };
    const result = await communicationService.getPatientCommunications(
      patientId,
      filters
    );
    return ResponseUtil.success(res, result);
  }),

  /**
   * Create an appointment reminder
   * @route POST /api/appointments/:appointmentId/reminder
   */
  createAppointmentReminder: asyncHandler(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    const Appointment = require('mongoose').model('Appointment');
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      throw new Error('Appointment not found');
    }
    const hoursInAdvance = req.body.hoursInAdvance;
    const reminder = await communicationService.createAppointmentReminder(
      appointment,
      hoursInAdvance
    );
    return ResponseUtil.success(res, { 
      reminder,
      message: 'Appointment reminder scheduled successfully'
    }, 201);
  }),

  /**
   * Create a test result notification
   * @route POST /api/medical-records/:recordId/test-result-notification
   */
  createTestResultNotification: asyncHandler(async (req, res) => {
    const recordId = req.params.recordId;
    const MedicalRecord = require('mongoose').model('MedicalRecord');
    const record = await MedicalRecord.findById(recordId)
      .populate('patient', '_id');
    if (!record) {
      throw new Error('Medical record not found');
    }
    const testResult = {
      _id: record._id,
      patient: record.patient._id,
      name: record.title,
      date: record.recordDate,
      medicalRecord: record._id
    };
    const urgent = req.body.urgent === true;
    const notification = await communicationService.createTestResultNotification(
      testResult,
      urgent
    );
    return ResponseUtil.success(res, { 
      notification,
      message: 'Test result notification sent successfully'
    }, 201);
  }),

  /**
   * Create a prescription refill alert
   * @route POST /api/prescriptions/:prescriptionId/refill-alert
   */
  createPrescriptionRefillAlert: asyncHandler(async (req, res) => {
    const prescriptionId = req.params.prescriptionId;
    const Prescription = require('mongoose').model('Prescription');
    const prescription = await Prescription.findById(prescriptionId);
    if (!prescription) {
      throw new Error('Prescription not found');
    }
    const daysBeforeEmpty = req.body.daysBeforeEmpty;
    const alert = await communicationService.createPrescriptionRefillAlert(
      prescription,
      daysBeforeEmpty
    );
    return ResponseUtil.success(res, { 
      alert,
      message: 'Prescription refill alert scheduled successfully'
    }, 201);
  }),

  /**
   * Create a medical record notification
   * @route POST /api/medical-records/:medicalRecordId/notification
   */
  createMedicalRecordNotification: asyncHandler(async (req, res) => {
    const medicalRecordId = req.params.medicalRecordId;
    // You may want to validate input here
    // Get the medical record
    const MedicalRecord = require('mongoose').model('MedicalRecord');
    const record = await MedicalRecord.findById(medicalRecordId);
    if (!record) {
      throw new Error('Medical record not found');
    }
    // Create the notification (implement this in your service)
    const notification = await communicationService.createMedicalRecordNotification(record, req.body);
    return ResponseUtil.success(res, { 
      notification,
      message: 'Medical record notification sent successfully'
    }, 201);
  }),

  /**
   * Send a health tip to a patient
   * @route POST /api/patients/:patientId/health-tip
   */
  sendHealthTip: asyncHandler(async (req, res) => {
    const { error, value } = healthTipSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid health tip data', error.details);
    }
    const patientId = req.params.patientId;
    const healthTip = await communicationService.createHealthTip(
      patientId,
      value
    );
    return ResponseUtil.success(res, { 
      healthTip,
      message: 'Health tip sent successfully'
    }, 201);
  }),

  /**
   * Send an emergency notification to a patient
   * @route POST /api/patients/:patientId/emergency-notification
   */
  sendEmergencyNotification: asyncHandler(async (req, res) => {
    const { error, value } = emergencyNotificationSchema.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid emergency notification data', error.details);
    }
    const patientId = req.params.patientId;
    const notification = await communicationService.createEmergencyNotification(
      patientId,
      value
    );
    return ResponseUtil.success(res, { 
      notification,
      message: 'Emergency notification sent successfully'
    }, 201);
  }),

  /**
   * Mark communication as read
   * @route PUT /api/communications/:communicationId/read
   */
  markCommunicationAsRead: asyncHandler(async (req, res) => {
    const communicationId = req.params.communicationId;
    const channel = req.body.channel;
    if (!channel) {
      throw new ValidationError('Channel is required');
    }
    const communication = await communicationService.markAsRead(
      communicationId,
      channel
    );
    return ResponseUtil.success(res, { 
      communication,
      message: 'Communication marked as read'
    });
  })
};

module.exports = communicationController;
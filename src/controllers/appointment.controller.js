/**
 * Appointment Controller
 * Handles appointment scheduling and management
 */

const logger = require('../utils/logger');
const asyncHandler = require('../utils/async-handler.util');
const { success } = require('../utils/response.util');
const ResponseUtil = require('../utils/response.util');
const Appointment = require('../models/appointment.model');
const Doctor = require('../models/doctor.model');
const Patient = require('../models/patient.model');
const { NotFoundError } = require('../utils/errors/NotFoundError');
const { BusinessLogicError } = require('../utils/errors/BusinessLogicError');
const { ValidationError } = require('../utils/errors/ValidationError');
const auditLogger = require('../utils/audit-logger');
const appointmentService = require('../services/appointment.service');
const appointmentValidator = require('../validators/appointment.validator');
const dateUtils = require('../utils/date.util');
const moment = require('moment');

/**
 * Controller for appointment operations in the Healthcare Management Application
 */
const appointmentController = {
  /**
   * Get appointments with pagination and filtering
   */
  getAppointments: asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      from, 
      to,
      patientId,
      doctorId,
      sortBy = 'appointmentDate',
      sortOrder = 'asc'
    } = req.query;
    
    const skip = (page - 1) * limit;
    
    const query = {};
    if (status) query.status = status;
    if (from || to) {
      query.appointmentDate = {};
      if (from) query.appointmentDate.$gte = new Date(from);
      if (to) query.appointmentDate.$lte = new Date(to);
    }
    if (patientId) query.patientId = patientId;
    if (doctorId) query.doctorId = doctorId;

    if (req.user.role === 'patient') query.patientId = req.user.patientId;
    else if (req.user.role === 'doctor') query.doctorId = req.user.doctorId;

    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    const [appointments, total] = await Promise.all([
      Appointment.find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ [sortBy]: sortDirection })
        .lean(),
      Appointment.countDocuments(query)
    ]);

    auditLogger.logDataAccess({
      userId: req.user.id,
      action: 'list',
      resourceType: 'appointment',
      resourceId: 'multiple',
      metadata: {
        filters: { status, from, to, patientId, doctorId },
        resultCount: appointments.length
      }
    });

    const totalPages = Math.ceil(total / limit);

    return success(res, {
      appointments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages
      }
    });
  }),

  /**
   * Create a new appointment
   * @route POST /api/appointments
   * @access Private
   */
  createAppointment: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = appointmentValidator.create.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid appointment data', error.details);
    }
    
    // Check if a lock ID was provided (from the booking flow)
    const lockId = req.body.lockId;
    
    // Create the appointment with optional lock ID
    const appointment = await appointmentService.createAppointment(value, lockId);
    
    return ResponseUtil.success(res, { 
      message: 'Appointment created successfully',
      appointment 
    }, 201);
  }),

  /**
   * Get appointment by ID
   * @route GET /api/appointments/:id
   * @access Private
   */
  getAppointmentById: asyncHandler(async (req, res) => {
    const options = {
      populatePatient: true,
      populateDoctor: true,
      populateAppointmentType: true
    };
    
    const appointment = await appointmentService.getAppointmentById(
      req.params.id,
      options
    );
    
    return ResponseUtil.success(res, { appointment });
  }),

  /**
   * Update appointment
   * @route PUT /api/appointments/:id
   * @access Private
   */
  updateAppointment: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = appointmentValidator.update.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid appointment data', error.details);
    }
    
    const appointment = await appointmentService.updateAppointment(
      req.params.id,
      value
    );
    
    return ResponseUtil.success(res, { 
      message: 'Appointment updated successfully',
      appointment 
    });
  }),

  /**
   * Cancel appointment
   * @route POST /api/appointments/:id/cancel
   * @access Private
   */
  cancelAppointment: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = appointmentValidator.cancel.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid cancellation data', error.details);
    }
    
    const appointment = await appointmentService.cancelAppointment(
      req.params.id,
      value.reason
    );
    
    return ResponseUtil.success(res, { 
      message: 'Appointment cancelled successfully',
      appointment 
    });
  }),

  /**
   * PATCH check-in or complete appointment status
   */
  updateAppointmentStatus: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'updateAppointmentStatus not implemented yet' });
  }),

  /**
   * Get available appointments (stub)
   */
  getAvailableAppointments: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'getAvailableAppointments not implemented yet' });
  }),

  /**
   * Send appointment reminder (stub)
   */
  sendAppointmentReminder: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'sendAppointmentReminder not implemented yet' });
  }),

  /**
   * Add appointment notes (stub)
   */
  addAppointmentNotes: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'addAppointmentNotes not implemented yet' });
  }),

  /**
   * Check appointment conflicts (stub)
   */
  checkAppointmentConflicts: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'checkAppointmentConflicts not implemented yet' });
  }),

  /**
   * Get available time slots for a doctor
   */
  getAvailableTimeSlots: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'getAvailableTimeSlots not implemented yet' });
  }),

  /**
   * Lock a time slot during booking process
   */
  lockTimeSlot: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'lockTimeSlot not implemented yet' });
  }),

  /**
   * Verify a slot lock is valid
   */
  verifySlotLock: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'verifySlotLock not implemented yet' });
  }),

  /**
   * Cleanup expired locks (admin endpoint)
   */
  cleanupExpiredLocks: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'cleanupExpiredLocks not implemented yet' });
  }),

  /**
   * Get patient appointments (stub)
   */
  getPatientAppointments: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'getPatientAppointments not implemented yet' });
  }),

  /**
   * Get doctor appointments (stub)
   */
  getDoctorAppointments: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, { message: 'getDoctorAppointments not implemented yet' });
  })
};

module.exports = appointmentController;
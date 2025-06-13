/**
 * Appointment Controller
 * Handles appointment scheduling and management
 */

const logger = require('../utils/logger');
const asyncHandler = require('../utils/async-handler.util');
const { success } = require('../utils/response.util');
const Appointment = require('../models/appointment.model');
const Doctor = require('../models/doctor.model');
const Patient = require('../models/patient.model');
const { NotFoundError } = require('../utils/errors/NotFoundError');
const { BusinessLogicError } = require('../utils/errors/BusinessLogicError');
const auditLogger = require('../utils/audit-logger');
const appointmentService = require('../services/appointment.service');
const dateUtils = require('../utils/date.util');
const moment = require('moment');

/**
 * Get appointments with pagination and filtering
 */
const getAppointments = asyncHandler(async (req, res) => {
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
});

// ----------- PLACEHOLDER CONTROLLERS -----------

const getAppointmentById = asyncHandler(async (req, res) => {
  return success(res, { message: 'getAppointmentById not implemented yet' });
});

const createAppointment = asyncHandler(async (req, res) => {
  return success(res, { message: 'createAppointment not implemented yet' });
});

const updateAppointment = asyncHandler(async (req, res) => {
  return success(res, { message: 'updateAppointment not implemented yet' });
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  return success(res, { message: 'updateAppointmentStatus not implemented yet' });
});

const cancelAppointment = asyncHandler(async (req, res) => {
  return success(res, { message: 'cancelAppointment not implemented yet' });
});

const getAvailableAppointments = asyncHandler(async (req, res) => {
  return success(res, { message: 'getAvailableAppointments not implemented yet' });
});

const sendAppointmentReminder = asyncHandler(async (req, res) => {
  return success(res, { message: 'sendAppointmentReminder not implemented yet' });
});

const addAppointmentNotes = asyncHandler(async (req, res) => {
  return success(res, { message: 'addAppointmentNotes not implemented yet' });
});

const checkAppointmentConflicts = asyncHandler(async (req, res) => {
  return success(res, { message: 'checkAppointmentConflicts not implemented yet' });
});

/**
 * Controller for appointment operations in the Healthcare Management Application
 */
const appointmentController = {
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
   * Get available time slots for a doctor
   * @route GET /api/appointments/available-slots
   * @access Private
   */
  getAvailableTimeSlots: asyncHandler(async (req, res) => {
    // Validate request parameters
    const { error, value } = appointmentValidator.availableSlots.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid request parameters', error.details);
    }
    
    // Format the requested date
    const date = dateUtils.parseDate(value.date);
    if (!date) {
      throw new ValidationError('Invalid date format');
    }
    
    // Get available slots
    const slots = await appointmentService.getAvailableTimeSlots(
      value.doctorId, 
      date, 
      value.appointmentTypeId
    );
    
    // Format the slots for client display
    const formattedSlots = slots.map(slot => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: slot.duration,
      formattedStartTime: moment(slot.startTime).format('h:mm A'),
      formattedEndTime: moment(slot.endTime).format('h:mm A')
    }));
    
    return ResponseUtil.success(res, { 
      count: formattedSlots.length,
      date: moment(date).format('YYYY-MM-DD'),
      slots: formattedSlots 
    });
  }),
  
  /**
   * Lock a time slot during booking process
   * @route POST /api/appointments/lock-slot
   * @access Private
   */
  lockTimeSlot: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = appointmentValidator.lockSlot.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid lock request data', error.details);
    }
    
    // Parse dates
    const startTime = new Date(value.startTime);
    const endTime = new Date(value.endTime);
    
    // Generate lock ID and temporarily lock the slot
    const lockResult = await appointmentService.lockTimeSlot(
      value.doctorId, 
      startTime, 
      endTime, 
      value.lockId || undefined
    );
    
    return ResponseUtil.success(res, { 
      message: 'Time slot locked successfully',
      lockId: lockResult.lockId,
      lockedUntil: lockResult.lockedUntil
    });
  }),
  
  /**
   * Verify a slot lock is valid
   * @route POST /api/appointments/verify-lock
   * @access Private
   */
  verifySlotLock: asyncHandler(async (req, res) => {
    // Validate request data
    const { error, value } = appointmentValidator.verifyLock.validate(req.body);
    if (error) {
      throw new ValidationError('Invalid verification request', error.details);
    }
    
    // Parse dates
    const startTime = new Date(value.startTime);
    const endTime = new Date(value.endTime);
    
    // Verify the lock
    const isValid = await appointmentService.verifySlotLock(
      value.doctorId, 
      startTime, 
      endTime, 
      value.lockId
    );
    
    return ResponseUtil.success(res, { 
      isValid,
      message: isValid ? 'Lock is valid' : 'Lock has expired or is invalid'
    });
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
   * Get patient appointments
   * @route GET /api/appointments/patient/:patientId
   * @access Private
   */
  getPatientAppointments: asyncHandler(async (req, res) => {
    // Extract filter parameters
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.startDate) {
      filters.startDate = req.query.startDate;
    }
    
    if (req.query.endDate) {
      filters.endDate = req.query.endDate;
    }
    
    const appointments = await appointmentService.getPatientAppointments(
      req.params.patientId,
      filters
    );
    
    return ResponseUtil.success(res, { 
      count: appointments.length,
      appointments 
    });
  }),
  
  /**
   * Get doctor appointments
   * @route GET /api/appointments/doctor/:doctorId
   * @access Private
   */
  getDoctorAppointments: asyncHandler(async (req, res) => {
    // Extract filter parameters
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status;
    }
    
    if (req.query.startDate) {
      filters.startDate = req.query.startDate;
    }
    
    if (req.query.endDate) {
      filters.endDate = req.query.endDate;
    }
    
    const appointments = await appointmentService.getDoctorAppointments(
      req.params.doctorId,
      filters
    );
    
    return ResponseUtil.success(res, { 
      count: appointments.length,
      appointments 
    });
  }),
  
  /**
   * Cleanup expired locks (admin endpoint)
   * @route POST /api/appointments/cleanup-locks
   * @access Private (Admin)
   */
  cleanupExpiredLocks: asyncHandler(async (req, res) => {
    const result = await appointmentService.cleanupExpiredLocks();
    
    return ResponseUtil.success(res, { 
      message: 'Expired locks cleaned up successfully',
      result 
    });
  })
};


// ----------- EXPORT -----------

module.exports = {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getAvailableAppointments,
  sendAppointmentReminder,
  addAppointmentNotes,
  checkAppointmentConflicts
};
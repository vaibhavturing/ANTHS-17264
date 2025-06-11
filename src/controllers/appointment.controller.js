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

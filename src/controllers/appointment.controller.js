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
  
  // Build query filters
  const query = {};
  
  // Apply filters
  if (status) {
    query.status = status;
  }
  
  // Date range filter
  if (from || to) {
    query.appointmentDate = {};
    if (from) {
      query.appointmentDate.$gte = new Date(from);
    }
    if (to) {
      query.appointmentDate.$lte = new Date(to);
    }
  }
  
  // Filter by patient or doctor
  if (patientId) {
    query.patientId = patientId;
  }
  
  if (doctorId) {
    query.doctorId = doctorId;
  }
  
  // Role-based filtering
  if (req.user.role === 'patient') {
    // Patients can only see their own appointments
    query.patientId = req.user.patientId;
  } else if (req.user.role === 'doctor') {
    // Doctors can only see their own appointments
    query.doctorId = req.user.doctorId;
  }
  
  // Sort direction
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  
  // Execute query with pagination
  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ [sortBy]: sortDirection })
      .lean(),
    Appointment.countDocuments(query)
  ]);
  
  // Log the access
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
  
  // Calculate pagination metadata
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

/**
 * Get a single appointment by ID
 */
const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).lean();
  
  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }
  
  // Log the access
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view',
    resourceType: 'appointment',
    resourceId: req.params.id,
    metadata: {
      patientId: appointment.patientId,
      doctorId: appointment.doctorId
    }
  });
  
  return success(res, { appointment });
});

/**
 * Create a new appointment
 */
const createAppointment = asyncHandler(async (req, res) => {
  const {
    patientId,
    doctorId,
    appointmentDate,
    appointmentType,
    reason,
    notes,
    duration
  } = req.body;
  
  // Verify patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Verify doctor exists
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new NotFoundError('Doctor not found');
  }
  
  // Check for scheduling conflicts
  const conflictingAppointment = await Appointment.findOne({
    doctorId,
    status: { $ne: 'cancelled' },
    appointmentDate: {
      $lt: new Date(new Date(appointmentDate).getTime() + (duration || 30) * 60000),
      $gt: new Date(new Date(appointmentDate).getTime() - 30 * 60000)
    }
  });
  
  if (conflictingAppointment) {
    throw new BusinessLogicError('The requested appointment time conflicts with an existing appointment');
  }
  
  // Create new appointment
  const appointment = new Appointment({
    patientId,
    doctorId,
    appointmentDate,
    appointmentType,
    reason,
    notes,
    duration: duration || 30, // default 30 minutes if not specified
    status: 'scheduled',
    createdBy: req.user.id
  });
  
  await appointment.save();
  
  // Log the creation
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'create',
    resourceType: 'appointment',
    resourceId: appointment._id.toString(),
    changes: {
      changedFields: Object.keys(req.body)
    }
  });
  
  logger.info('New appointment scheduled', { 
    appointmentId: appointment._id,
    patientId,
    doctorId,
    dateTime: appointmentDate
  });
  
  return success(res, { appointment }, 201);
});

/**
 * Update an appointment
 */
const updateAppointment = asyncHandler(async (req, res) => {
  const appointmentId = req.params.id;
  const updateData = req.body;
  
  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }
  
  // Check if appointment is already completed or cancelled
  if (['completed', 'cancelled'].includes(appointment.status)) {
    throw new BusinessLogicError(`Cannot update a ${appointment.status} appointment`);
  }
  
  // Save previous data for audit
  const previousData = appointment.toObject();
  
  // Check for scheduling conflicts if date is being updated
  if (updateData.appointmentDate && 
      updateData.appointmentDate !== appointment.appointmentDate.toISOString()) {
    const conflictingAppointment = await Appointment.findOne({
      _id: { $ne: appointmentId },
      doctorId: appointment.doctorId,
      status: { $ne: 'cancelled' },
      appointmentDate: {
        $lt: new Date(new Date(updateData.appointmentDate).getTime() + (updateData.duration || appointment.duration) * 60000),
        $gt: new Date(new Date(updateData.appointmentDate).getTime() - 30 * 60000)
      }
    });
    
    if (conflictingAppointment) {
      throw new BusinessLogicError('The requested appointment time conflicts with an existing appointment');
    }
  }
  
  // Update fields
  Object.keys(updateData).forEach(key => {
    // Cannot directly change appointmentId once created
    if (key !== 'patientId' && key !== 'doctorId') {
      appointment[key] = updateData[key];
    }
  });
  
  appointment.updatedAt = new Date();
  appointment.updatedBy = req.user.id;
  
  await appointment.save();
  
  // Log the update
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update',
    resourceType: 'appointment',
    resourceId: appointmentId,
    changes: {
      changedFields: Object.keys(updateData),
      previousData
    }
  });
  
  logger.info('Appointment updated', { 
    appointmentId, 
    fields: Object.keys(updateData) 
  });
  
  return success(res, { appointment });
});

/**
 * Update appointment status
 */
const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const appointmentId = req.params.id;
  const { status, statusReason } = req.body;
  
  // Valid status transitions
  const validStatuses = ['scheduled', 'confirmed', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'];
  
  if (!validStatuses.includes(status)) {
    throw new BusinessLogicError(`Invalid status: ${status}`);
  }
  
  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }
  
  // Save previous status for audit
  const previousStatus = appointment.status;
  
  // Update status
  appointment.status = status;
  if (statusReason) {
    appointment.statusReason = statusReason;
  }
  appointment.updatedAt = new Date();
  appointment.updatedBy = req.user.id;
  
  // Set special timestamps
  if (status === 'checked-in') {
    appointment.checkedInAt = new Date();
  } else if (status === 'in-progress') {
    appointment.startedAt = new Date();
  } else if (status === 'completed') {
    appointment.completedAt = new Date();
  } else if (status === 'cancelled') {
    appointment.cancelledAt = new Date();
  } else if (status === 'no-show') {
    appointment.noShowAt = new Date();
  }
  
  await appointment.save();
  
  // Log the status change
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update_status',
    resourceType: 'appointment',
    resourceId: appointmentId,
    changes: {
      previousStatus,
      newStatus: status,
      statusReason
    }
  });
  
  logger.info(`Appointment status changed from ${previousStatus} to ${status}`, {
    appointmentId
  });
  
  return success(res, { appointment });
});

/**
 * Cancel an appointment
 */
const cancelAppointment = asyncHandler(async (req, res) => {
  const appointmentId = req.params.id;
  const { reason } = req.body;
  
  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }
  
  // Check if appointment is already completed or cancelled
  if (['completed', 'cancelled', 'no-show'].includes(appointment.status)) {
    throw new BusinessLogicError(`Cannot cancel a ${appointment.status} appointment`);
  }
  
  // Save previous status for audit
  const previousStatus = appointment.status;
  
  // Update appointment
  appointment.status = 'cancelled';
  appointment.statusReason = reason || 'Cancelled by user';
  appointment.cancelledAt = new Date();
  appointment.cancelledBy = req.user.id;
  appointment.updatedAt = new Date();
  appointment.updatedBy = req.user.id;
  
  await appointment.save();
  
  // Log the cancellation
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'cancel',
    resourceType: 'appointment',
    resourceId: appointmentId,
    changes: {
      previousStatus,
      reason
    }
  });
  
  logger.info('Appointment cancelled', { appointmentId, reason });
  
  return success(res, { 
    message: 'Appointment successfully cancelled',
    appointment
  });
});

/**
 * Get available appointment slots
 */
const getAvailableAppointments = asyncHandler(async (req, res) => {
  const { doctorId, date, duration = 30 } = req.query;
  
  if (!doctorId || !date) {
    throw new BusinessLogicError('Doctor ID and date are required');
  }
  
  // Verify doctor exists
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    throw new NotFoundError('Doctor not found');
  }
  
  // Check doctor availability
  if (!doctor.availability.isAvailable) {
    return success(res, { 
      available: false,
      message: 'Doctor is not available for appointments',
      slots: []
    });
  }
  
  // Parse date
  const searchDate = new Date(date);
  const dayOfWeek = searchDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Get working hours for the day
  const dayHours = doctor.availability.workingHours.find(
    day => day.dayOfWeek === dayOfWeek
  );
  
  if (!dayHours || !dayHours.isWorkingDay) {
    return success(res, { 
      available: false,
      message: 'Doctor does not work on this day',
      slots: []
    });
  }
  
  // Convert hours to timestamps
  const startTime = new Date(searchDate);
  startTime.setHours(dayHours.startHour, dayHours.startMinute, 0, 0);
  
  const endTime = new Date(searchDate);
  endTime.setHours(dayHours.endHour, dayHours.endMinute, 0, 0);
  
  // Get existing appointments for that day
  const existingAppointments = await Appointment.find({
    doctorId,
    status: { $nin: ['cancelled', 'no-show'] },
    appointmentDate: {
      $gte: new Date(searchDate.setHours(0, 0, 0, 0)),
      $lt: new Date(searchDate.setHours(23, 59, 59, 999))
    }
  }).select('appointmentDate duration').sort({ appointmentDate: 1 }).lean();
  
  // Calculate available slots
  const availableSlots = calculateAvailableSlots(
    startTime,
    endTime,
    parseInt(duration),
    existingAppointments
  );
  
  return success(res, {
    doctorId,
    date: date,
    available: availableSlots.length > 0,
    slots: availableSlots
  });
});

/**
 * Helper function to calculate available appointment slots
 */
const calculateAvailableSlots = (startTime, endTime, slotDuration, existingAppointments) => {
  const slots = [];
  const current = new Date(startTime);
  const busyTimes = existingAppointments.map(apt => ({
    start: new Date(apt.appointmentDate),
    end: new Date(new Date(apt.appointmentDate).getTime() + apt.duration * 60000)
  }));
  
  // Generate slots at fixed intervals
  while (current < endTime) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60000);
    
    // Skip if slot exceeds end time
    if (slotEnd > endTime) {
      break;
    }
    
    // Check if slot overlaps with any existing appointment
    const isOverlapping = busyTimes.some(busy => {
      return (current < busy.end && slotEnd > busy.start);
    });
    
    if (!isOverlapping) {
      slots.push({
        start: new Date(current),
        end: slotEnd,
        time: current.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        duration: slotDuration
      });
    }
    
    // Move to next slot
    current.setMinutes(current.getMinutes() + slotDuration);
  }
  
  return slots;
};

/**
 * Send appointment reminder
 */
const sendAppointmentReminder = asyncHandler(async (req, res) => {
  const appointmentId = req.params.id;
  
  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }
  
  // Get patient and doctor info for the message
  const [patient, doctor] = await Promise.all([
    Patient.findById(appointment.patientId).select('firstName lastName contactInformation').lean(),
    Doctor.findById(appointment.doctorId).select('firstName lastName professionalDetails').lean()
  ]);
  
  if (!patient || !doctor) {
    throw new NotFoundError('Patient or doctor not found');
  }
  
  // In a real application, this would send an actual SMS/email reminder
  // Here we'll just log it and update the reminder sent status
  
  // Update appointment
  appointment.reminderSent = true;
  appointment.reminderSentAt = new Date();
  appointment.updatedAt = new Date();
  appointment.updatedBy = req.user.id;
  
  await appointment.save();
  
  // Log the reminder
  logger.info('Appointment reminder sent', { 
    appointmentId,
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentDate: appointment.appointmentDate
  });
  
  return success(res, { 
    message: 'Appointment reminder sent',
    sentTo: patient.contactInformation.email,
    appointment: {
      id: appointment._id,
      date: appointment.appointmentDate,
      reminderSentAt: appointment.reminderSentAt
    }
  });
});

/**
 * Add notes to an appointment
 */
const addAppointmentNotes = asyncHandler(async (req, res) => {
  const appointmentId = req.params.id;
  const { notes } = req.body;
  
  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new NotFoundError('Appointment not found');
  }
  
  // Save previous notes for audit
  const previousNotes = appointment.notes;
  
  // Update notes
  appointment.notes = notes;
  appointment.updatedAt = new Date();
  appointment.updatedBy = req.user.id;
  
  await appointment.save();
  
  // Log the note addition
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update_notes',
    resourceType: 'appointment',
    resourceId: appointmentId,
    changes: {
      previousNotes,
      newNotes: notes
    }
  });
  
  logger.info('Appointment notes updated', { appointmentId });
  
  return success(res, { 
    message: 'Appointment notes updated',
    appointment: {
      id: appointment._id,
      notes: appointment.notes,
      updatedAt: appointment.updatedAt
    }
  });
});

/**
 * Check for appointment conflicts
 */
const checkAppointmentConflicts = asyncHandler(async (req, res) => {
  const { doctorId, patientId, appointmentDate, duration = 30 } = req.query;
  
  if (!doctorId || !appointmentDate) {
    throw new BusinessLogicError('Doctor ID and appointment date are required');
  }
  
  const appointmentTime = new Date(appointmentDate);
  
  // Look for conflicting doctor appointments
  const doctorConflicts = await Appointment.find({
    doctorId,
    status: { $nin: ['cancelled', 'no-show'] },
    appointmentDate: {
      $lt: new Date(appointmentTime.getTime() + parseInt(duration) * 60000),
      $gt: new Date(appointmentTime.getTime() - 30 * 60000)
    }
  }).select('appointmentDate duration patientId status').lean();
  
  // Look for conflicting patient appointments (if patient ID provided)
  let patientConflicts = [];
  if (patientId) {
    patientConflicts = await Appointment.find({
      patientId,
      _id: { $nin: doctorConflicts.map(a => a._id) }, // Exclude any that are already in doctor conflicts
      status: { $nin: ['cancelled', 'no-show'] },
      appointmentDate: {
        $lt: new Date(appointmentTime.getTime() + 120 * 60000), // 2 hours later
        $gt: new Date(appointmentTime.getTime() - 120 * 60000)  // 2 hours before
      }
    }).select('appointmentDate duration doctorId status').lean();
  }
  
  return success(res, {
    hasConflicts: doctorConflicts.length > 0 || patientConflicts.length > 0,
    doctorConflicts,
    patientConflicts
  });
});

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
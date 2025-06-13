const emergencyScheduleService = require('../services/emergencySchedule.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

/**
 * Controller for emergency schedule operations
 * This is a new controller file added for handling emergency schedule overrides
 */
const emergencyScheduleController = {
  /**
   * Register emergency unavailability for a doctor
   * @route POST /api/emergency/doctor/:doctorId/unavailable
   */
  registerEmergencyUnavailability: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const { startDate, endDate, reason, notifyPatients, suggestAlternatives } = req.body;
    
    // Only admins can register emergency unavailability
    if (req.user.role !== 'admin') {
      throw new ValidationError('Only administrators can register emergency unavailability');
    }
    
    const result = await emergencyScheduleService.registerEmergencyUnavailability(
      doctorId,
      new Date(startDate),
      new Date(endDate),
      reason,
      {
        adminId: req.user.id,
        notifyPatients,
        suggestAlternatives
      }
    );
    
    return ResponseUtil.success(res, { 
      message: 'Emergency unavailability registered successfully',
      leaveId: result.leave._id,
      affectedAppointments: result.affectedAppointments.length
    });
  }),

  /**
   * Get appointments affected by emergency
   * @route GET /api/emergency/leave/:leaveId/appointments
   */
  getAffectedAppointments: asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    
    // Only admins can view affected appointments
    if (req.user.role !== 'admin' && req.user.role !== 'receptionist') {
      throw new ValidationError('Insufficient permissions to view affected appointments');
    }
    
    const appointments = await emergencyScheduleService.getAffectedAppointmentsByLeave(leaveId);
    
    return ResponseUtil.success(res, { appointments });
  }),
  
  /**
   * Get available slots for rescheduling
   * @route GET /api/emergency/appointment/:appointmentId/alternatives
   */
  getAlternativeSlots: asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const { startDate, endDate, doctorId } = req.query;
    
    // Only admins can get alternative slots
    if (req.user.role !== 'admin' && req.user.role !== 'receptionist') {
      throw new ValidationError('Insufficient permissions to view alternative slots');
    }
    
    const alternativeSlots = await emergencyScheduleService.getAlternativeSlotsForAppointment(
      appointmentId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        doctorId
      }
    );
    
    return ResponseUtil.success(res, { alternativeSlots });
  }),
  
  /**
   * Reschedule affected appointment
   * @route POST /api/emergency/appointment/:appointmentId/reschedule
   */
  rescheduleAppointment: asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const { doctorId, startTime, notifyPatient } = req.body;
    
    // Only admins can reschedule appointments
    if (req.user.role !== 'admin' && req.user.role !== 'receptionist') {
      throw new ValidationError('Insufficient permissions to reschedule appointments');
    }
    
    const result = await emergencyScheduleService.rescheduleEmergencyAppointment(
      appointmentId,
      doctorId,
      new Date(startTime),
      {
        adminId: req.user.id,
        notifyPatient
      }
    );
    
    return ResponseUtil.success(res, { 
      message: 'Appointment rescheduled successfully',
      result
    });
  }),
  
  /**
   * Cancel affected appointment without rescheduling
   * @route POST /api/emergency/appointment/:appointmentId/cancel
   */
  cancelAppointment: asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    const { notifyPatient } = req.body;
    
    // Only admins can cancel appointments
    if (req.user.role !== 'admin' && req.user.role !== 'receptionist') {
      throw new ValidationError('Insufficient permissions to cancel appointments');
    }
    
    const result = await emergencyScheduleService.cancelEmergencyAppointment(
      appointmentId,
      {
        adminId: req.user.id,
        notifyPatient
      }
    );
    
    return ResponseUtil.success(res, { 
      message: 'Appointment cancelled successfully',
      result
    });
  })
};

module.exports = emergencyScheduleController;
const express = require('express');
const emergencyScheduleController = require('../controllers/emergencySchedule.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const emergencyValidator = require('../validators/emergency.validator');

const router = express.Router();

/**
 * @route   POST /api/emergency/doctor/:doctorId/unavailable
 * @desc    Register emergency unavailability for a doctor
 * @access  Admin only
 */
router.post(
  '/doctor/:doctorId/unavailable',
  authMiddleware(['admin']),
  validateRequest(emergencyValidator.doctorIdParam, 'params'),
  validateRequest(emergencyValidator.registerEmergencyUnavailability),
  emergencyScheduleController.registerEmergencyUnavailability
);

/**
 * @route   GET /api/emergency/leave/:leaveId/appointments
 * @desc    Get appointments affected by emergency
 * @access  Admin, Receptionist
 */
router.get(
  '/leave/:leaveId/appointments',
  authMiddleware(['admin', 'receptionist']),
  validateRequest(emergencyValidator.leaveIdParam, 'params'),
  emergencyScheduleController.getAffectedAppointments
);

/**
 * @route   GET /api/emergency/appointment/:appointmentId/alternatives
 * @desc    Get available slots for rescheduling
 * @access  Admin, Receptionist
 */
router.get(
  '/appointment/:appointmentId/alternatives',
  authMiddleware(['admin', 'receptionist']),
  validateRequest(emergencyValidator.appointmentIdParam, 'params'),
  emergencyScheduleController.getAlternativeSlots
);

/**
 * @route   POST /api/emergency/appointment/:appointmentId/reschedule
 * @desc    Reschedule affected appointment
 * @access  Admin, Receptionist
 */
router.post(
  '/appointment/:appointmentId/reschedule',
  authMiddleware(['admin', 'receptionist']),
  validateRequest(emergencyValidator.appointmentIdParam, 'params'),
  validateRequest(emergencyValidator.rescheduleAppointment),
  emergencyScheduleController.rescheduleAppointment
);

/**
 * @route   POST /api/emergency/appointment/:appointmentId/cancel
 * @desc    Cancel affected appointment without rescheduling
 * @access  Admin, Receptionist
 */
router.post(
  '/appointment/:appointmentId/cancel',
  authMiddleware(['admin', 'receptionist']),
  validateRequest(emergencyValidator.appointmentIdParam, 'params'),
  validateRequest(emergencyValidator.cancelAppointment),
  emergencyScheduleController.cancelAppointment
);

module.exports = router;
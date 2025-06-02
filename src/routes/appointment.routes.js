/**
 * Appointment Management Routes
 * Handles scheduling, rescheduling, and appointment management
 */

const express = require('express');
const appointmentController = require('../controllers/appointment.controller');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const appointmentValidator = require('../validators/appointment.validator');

const router = express.Router();

/**
 * @route GET /api/appointments
 * @desc Get a list of appointments (paginated, filtered)
 * @access Authenticated users (filtered by role)
 */
router.get(
  '/',
  auth.authenticate,
  validate(appointmentValidator.getAppointmentsQuery),
  appointmentController.getAppointments
);

/**
 * @route GET /api/appointments/:id
 * @desc Get a single appointment by ID
 * @access Participants (patient, doctor) or admin
 */
router.get(
  '/:id',
  auth.requireAppointmentParticipantOrAdmin('id'),
  appointmentController.getAppointmentById
);

/**
 * @route POST /api/appointments
 * @desc Create a new appointment
 * @access Patients, doctors, admin, reception
 */
router.post(
  '/',
  auth.requireAnyRole(['patient', 'doctor', 'admin', 'reception']),
  validate(appointmentValidator.createAppointmentSchema),
  appointmentController.createAppointment
);

/**
 * @route PUT /api/appointments/:id
 * @desc Update an appointment (reschedule)
 * @access Participants (patient, doctor) or admin
 */
router.put(
  '/:id',
  auth.requireAppointmentParticipantOrAdmin('id'),
  validate(appointmentValidator.updateAppointmentSchema),
  appointmentController.updateAppointment
);

/**
 * @route PATCH /api/appointments/:id/status
 * @desc Update appointment status (confirm, cancel, complete)
 * @access Participants (patient, doctor) or admin
 */
router.patch(
  '/:id/status',
  auth.requireAppointmentParticipantOrAdmin('id'),
  validate(appointmentValidator.updateAppointmentStatusSchema),
  appointmentController.updateAppointmentStatus
);

/**
 * @route DELETE /api/appointments/:id
 * @desc Cancel an appointment (soft delete)
 * @access Participants (patient, doctor) or admin
 */
router.delete(
  '/:id',
  auth.requireAppointmentParticipantOrAdmin('id'),
  validate(appointmentValidator.cancelAppointmentSchema),
  appointmentController.cancelAppointment
);

/**
 * @route GET /api/appointments/available
 * @desc Get available appointment slots
 * @access Any authenticated user
 */
router.get(
  '/available',
  auth.authenticate,
  validate(appointmentValidator.getAvailableAppointmentsQuery),
  appointmentController.getAvailableAppointments
);

/**
 * @route POST /api/appointments/:id/reminder
 * @desc Send appointment reminder
 * @access Admin, reception
 */
router.post(
  '/:id/reminder',
  auth.requireAnyRole(['admin', 'reception']),
  appointmentController.sendAppointmentReminder
);

/**
 * @route POST /api/appointments/:id/notes
 * @desc Add notes to an appointment
 * @access Doctor or admin
 */
router.post(
  '/:id/notes',
  auth.requireAnyRole(['doctor', 'admin']),
  validate(appointmentValidator.appointmentNotesSchema),
  appointmentController.addAppointmentNotes
);

/**
 * @route GET /api/appointments/conflicts
 * @desc Check for appointment conflicts
 * @access Any authenticated user
 */
router.get(
  '/conflicts',
  auth.authenticate,
  validate(appointmentValidator.checkConflictsQuery),
  appointmentController.checkAppointmentConflicts
);

module.exports = router;
const express = require('express');
const appointmentTypeController = require('../controllers/appointmentType.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const appointmentTypeValidator = require('../validators/appointmentType.validator');

const router = express.Router();

/**
 * @route   POST /api/appointment-types
 * @desc    Create a new appointment type
 * @access  Admin
 */
router.post(
  '/',
  authMiddleware(['admin']),
  validateRequest(appointmentTypeValidator.createAppointmentType),
  appointmentTypeController.createAppointmentType
);

/**
 * @route   GET /api/appointment-types
 * @desc    Get all appointment types
 * @access  All authenticated users
 */
router.get(
  '/',
  authMiddleware(),
  appointmentTypeController.getAllAppointmentTypes
);

/**
 * @route   GET /api/appointment-types/:id
 * @desc    Get appointment type by ID
 * @access  All authenticated users
 */
router.get(
  '/:id',
  authMiddleware(),
  validateRequest(appointmentTypeValidator.idParam, 'params'),
  appointmentTypeController.getAppointmentTypeById
);

/**
 * @route   PUT /api/appointment-types/:id
 * @desc    Update appointment type
 * @access  Admin
 */
router.put(
  '/:id',
  authMiddleware(['admin']),
  validateRequest(appointmentTypeValidator.idParam, 'params'),
  validateRequest(appointmentTypeValidator.updateAppointmentType),
  appointmentTypeController.updateAppointmentType
);

/**
 * @route   DELETE /api/appointment-types/:id
 * @desc    Delete appointment type
 * @access  Admin
 */
router.delete(
  '/:id',
  authMiddleware(['admin']),
  validateRequest(appointmentTypeValidator.idParam, 'params'),
  appointmentTypeController.deleteAppointmentType
);

/**
 * @route   PUT /api/appointment-types/:id/doctor-settings/:doctorId
 * @desc    Update doctor-specific settings for an appointment type
 * @access  Admin or the specific doctor
 */
router.put(
  '/:id/doctor-settings/:doctorId',
  authMiddleware(), // Further permission checks in the controller
  validateRequest(appointmentTypeValidator.idParam, 'params'),
  validateRequest(appointmentTypeValidator.doctorIdParam, 'params'),
  validateRequest(appointmentTypeValidator.updateDoctorSettings),
  appointmentTypeController.updateDoctorSettings
);

/**
 * @route   GET /api/doctors/:doctorId/appointment-types
 * @desc    Get appointment types for a specific doctor
 * @access  All authenticated users
 */
router.get(
  '/doctor/:doctorId',
  authMiddleware(),
  validateRequest(appointmentTypeValidator.doctorIdParam, 'params'),
  appointmentTypeController.getAppointmentTypesForDoctor
);

module.exports = router;
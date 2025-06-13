// src/routes/appointment.routes.js

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate.middleware');
const { auth } = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

const appointmentController = require('../controllers/appointment.controller');
const {
  createAppointmentSchema,
  updateAppointmentSchema,
  getAppointmentByIdSchema,
  deleteAppointmentSchema,
  getAppointmentsSchema,
  checkInAppointmentSchema,
  completeAppointmentSchema
} = require('../validators/appointment.validator');

// GET all appointments (with filters, pagination)
router.get(
  '/',
  auth(),
  validate(getAppointmentsSchema),
  appointmentController.getAppointments
);


// Get available time slots for a doctor
router.get('/available-slots', 
  authMiddleware.protect, 
  appointmentController.getAvailableTimeSlots
);


// GET appointment by ID
router.get(
  '/:appointmentId',
  auth(),
  validate(getAppointmentByIdSchema),
  appointmentController.getAppointmentById
);

// POST create appointment
router.post(
  '/',
  auth(),
  validate(createAppointmentSchema),
  appointmentController.createAppointment
);

// PUT update appointment
router.put(
  '/:appointmentId',
  auth(),
  validate(updateAppointmentSchema),
  appointmentController.updateAppointment
);

// PATCH cancel appointment
router.patch(
  '/:appointmentId/cancel',
  auth(),
  validate(deleteAppointmentSchema),
  appointmentController.cancelAppointment
);

// PATCH check-in to appointment
router.patch(
  '/:appointmentId/check-in',
  auth(),
  validate(checkInAppointmentSchema),
  appointmentController.updateAppointmentStatus
);

// PATCH complete appointment
router.patch(
  '/:appointmentId/complete',
  auth(),
  validate(completeAppointmentSchema),
  appointmentController.updateAppointmentStatus
);

module.exports = router;

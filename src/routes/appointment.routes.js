const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

/**
 * Appointment routes
 * @route /api/appointments
 */

// Get all appointments with pagination/filtering
router.get(
  '/',
  authMiddleware.protect,
  appointmentController.getAppointments
);

// Get available time slots for a doctor
router.get(
  '/available-slots',
  authMiddleware.protect,
  appointmentController.getAvailableTimeSlots
);

// Lock a time slot during booking process
router.post(
  '/lock-slot',
  authMiddleware.protect,
  appointmentController.lockTimeSlot
);

// Verify a slot lock is valid
router.post(
  '/verify-lock',
  authMiddleware.protect,
  appointmentController.verifySlotLock
);

// Cleanup expired locks (admin only)
router.post(
  '/cleanup-locks',
  authMiddleware.protect,
  permissionMiddleware.restrictTo('admin'),
  appointmentController.cleanupExpiredLocks
);

// Get appointments for a specific patient
router.get(
  '/patient/:patientId',
  authMiddleware.protect,
  appointmentController.getPatientAppointments
);

// Get appointments for a specific doctor
router.get(
  '/doctor/:doctorId',
  authMiddleware.protect,
  appointmentController.getDoctorAppointments
);

// Create new appointment
router.post(
  '/',
  authMiddleware.protect,
  appointmentController.createAppointment
);

// Get appointment by ID
router.get(
  '/:id',
  authMiddleware.protect,
  appointmentController.getAppointmentById
);

// Update appointment
router.put(
  '/:id',
  authMiddleware.protect,
  appointmentController.updateAppointment
);

// Cancel appointment
router.post(
  '/:id/cancel',
  authMiddleware.protect,
  appointmentController.cancelAppointment
);

module.exports = router;
// src/routes/doctor-schedule.routes.js
const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Get doctor's schedule
router.get('/:doctorId/schedule',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('appointments', 'read'),
  appointmentController.getDoctorSchedule
);

// Get available time slots for a doctor
router.get('/:doctorId/available-slots',
  authMiddleware.authenticateUser, // Allow any authenticated user to view slots
  appointmentController.getAvailableTimeSlots
);

module.exports = router;
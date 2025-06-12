// File: src/routes/schedule.routes.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');
const { scheduleValidator } = require('../validators/schedule.validator');
const validateMiddleware = require('../middleware/validate.middleware');

// Create a recurring schedule template
router.post(
  '/templates',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'create'),
  validateMiddleware(scheduleValidator.createTemplate),
  scheduleController.createRecurringTemplate
);

// Update a recurring schedule template
router.put(
  '/templates/:templateId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'update'),
  validateMiddleware(scheduleValidator.updateTemplate),
  scheduleController.updateRecurringTemplate
);

// Get all recurring templates for a doctor
router.get(
  '/templates/doctor/:doctorId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'read'),
  scheduleController.getDoctorTemplates
);

// Get my templates (for logged-in doctor)
router.get(
  '/templates/me',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'read'),
  scheduleController.getDoctorTemplates
);

// Generate doctor schedules for a date range
router.post(
  '/generate/doctor/:doctorId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'create'),
  validateMiddleware(scheduleValidator.generateSchedules),
  scheduleController.generateScheduleRange
);

// Get doctor schedule for a specific day
router.get(
  '/doctor/:doctorId/day',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'read'),
  scheduleController.getDoctorScheduleForDay
);

// Get doctor schedules for a date range
router.get(
  '/doctor/:doctorId/range',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'read'),
  scheduleController.getDoctorSchedulesByDateRange
);

// Update a doctor's schedule
router.put(
  '/:scheduleId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'update'),
  validateMiddleware(scheduleValidator.updateSchedule),
  scheduleController.updateDoctorSchedule
);

// Check for schedule conflicts
router.post(
  '/check-conflicts',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('schedules', 'read'),
  validateMiddleware(scheduleValidator.checkConflicts),
  scheduleController.checkScheduleConflicts
);

module.exports = router;
// File: src/routes/availability.routes.js
const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availability.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');
const { availabilityValidator } = require('../validators/availability.validator');
const validateMiddleware = require('../middleware/validate.middleware');

// Create a doctor's availability configuration
router.post(
  '/',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('availability', 'create'),
  validateMiddleware(availabilityValidator.createAvailability),
  availabilityController.createAvailability
);

// Update a doctor's availability configuration
router.put(
  '/:availabilityId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('availability', 'update'),
  validateMiddleware(availabilityValidator.updateAvailability),
  availabilityController.updateAvailability
);

// Create a new leave request
router.post(
  '/leave',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('leave', 'create'),
  validateMiddleware(availabilityValidator.createLeaveRequest),
  availabilityController.createLeaveRequest
);

// Update a leave request status
router.put(
  '/leave/:leaveId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('leave', 'update'),
  validateMiddleware(availabilityValidator.updateLeaveStatus),
  availabilityController.updateLeaveStatus
);

// Get all leave requests for a doctor
router.get(
  '/leave/doctor/:doctorId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('leave', 'read'),
  availabilityController.getDoctorLeaves
);

// Get my leave requests (for logged-in doctor)
router.get(
  '/leave/me',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('leave', 'read'),
  availabilityController.getDoctorLeaves
);

// Schedule a break for a doctor
router.post(
  '/break',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('break', 'create'),
  validateMiddleware(availabilityValidator.scheduleBreak),
  availabilityController.scheduleBreak
);

// Update a scheduled break
router.put(
  '/break/:breakId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('break', 'update'),
  validateMiddleware(availabilityValidator.updateBreak),
  availabilityController.updateBreak
);

// Get all breaks for a doctor by date range
router.get(
  '/break/doctor/:doctorId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('break', 'read'),
  availabilityController.getDoctorBreaks
);

// Get my breaks (for logged-in doctor)
router.get(
  '/break/me',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('break', 'read'),
  availabilityController.getDoctorBreaks
);

// Get doctor availability information for a date
router.get(
  '/doctor/:doctorId/date',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('availability', 'read'),
  availabilityController.getDoctorAvailabilityForDate
);

// Check doctor availability for a specific time slot
router.post(
  '/check',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('availability', 'read'),
  validateMiddleware(availabilityValidator.checkAvailability),
  availabilityController.checkDoctorAvailability
);

module.exports = router;
// File: src/routes/appointmentType.routes.js (Fixed version)
const express = require('express');
const router = express.Router();
const appointmentTypeController = require('../controllers/appointmentType.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');
const validateMiddleware = require('../middleware/validate.middleware');

// FIXED: Create a minimal validator if not already defined
// This is a temporary placeholder if your validator module isn't fully implemented
const appointmentTypeValidator = {
  createAppointmentType: [],
  updateAppointmentType: [],
  toggleStatus: []
};

// Try to import the real validator, but use the minimal one as fallback
try {
  const { appointmentTypeValidator: realValidator } = require('../validators/appointmentType.validator');
  if (realValidator) {
    Object.assign(appointmentTypeValidator, realValidator);
  }
} catch (error) {
  console.warn('Warning: Using minimal appointment type validators. Real validator not available.');
}

// Create a new appointment type
router.post(
  '/',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('appointmentTypes', 'create'),
  validateMiddleware(appointmentTypeValidator.createAppointmentType),
  appointmentTypeController.createAppointmentType
);

// Update an appointment type
router.put(
  '/:typeId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('appointmentTypes', 'update'),
  validateMiddleware(appointmentTypeValidator.updateAppointmentType),
  appointmentTypeController.updateAppointmentType
);

// Get appointment type by ID
router.get(
  '/:typeId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('appointmentTypes', 'read'),
  appointmentTypeController.getAppointmentTypeById
);

// Get all appointment types with optional filtering
router.get(
  '/',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('appointmentTypes', 'read'),
  appointmentTypeController.getAllAppointmentTypes
);

// Get appointment types for a department
router.get(
  '/department/:departmentId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('appointmentTypes', 'read'),
  appointmentTypeController.getAppointmentTypesByDepartment
);

// Toggle appointment type status (active/inactive)
router.patch(
  '/:typeId/status',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('appointmentTypes', 'update'),
  validateMiddleware(appointmentTypeValidator.toggleStatus),
  appointmentTypeController.toggleAppointmentTypeStatus
);

module.exports = router;
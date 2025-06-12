// File: src/routes/appointmentType.routes.js
const express = require('express');
const router = express.Router();
const appointmentTypeController = require('../controllers/appointmentType.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');
const { appointmentTypeValidator } = require('../validators/appointmentType.validator');
const validateMiddleware = require('../middleware/validate.middleware');

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
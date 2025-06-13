const express = require('express');
const router = express.Router();
const appointmentTypeController = require('../controllers/appointmentType.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

/**
 * Appointment type routes
 * @route /api/appointment-types
 */

// Get all appointment types
router.get('/', 
  authMiddleware.protect, 
  appointmentTypeController.getAppointmentTypes
);

// Get appointment type by ID
router.get('/:id', 
  authMiddleware.protect, 
  appointmentTypeController.getAppointmentTypeById
);

// Get appointment types for a specific doctor
router.get('/doctor/:doctorId', 
  authMiddleware.protect, 
  appointmentTypeController.getAppointmentTypesForDoctor
);

// Create new appointment type (Admin only)
router.post('/', 
  authMiddleware.protect, 
  permissionMiddleware.restrictTo('admin'), 
  appointmentTypeController.createAppointmentType
);

// Initialize default appointment types (Admin only)
router.post('/initialize', 
  authMiddleware.protect, 
  permissionMiddleware.restrictTo('admin'), 
  appointmentTypeController.initializeDefaultTypes
);

// Update appointment type (Admin only)
router.put('/:id', 
  authMiddleware.protect, 
  permissionMiddleware.restrictTo('admin'), 
  appointmentTypeController.updateAppointmentType
);

// Delete appointment type (Admin only)
router.delete('/:id', 
  authMiddleware.protect, 
  permissionMiddleware.restrictTo('admin'), 
  appointmentTypeController.deleteAppointmentType
);

module.exports = router;
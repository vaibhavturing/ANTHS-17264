// src/routes/patient-appointment.routes.js
const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Get patient's appointments
router.get('/:patientId/appointments',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkResourceOwnership('patient'),
  appointmentController.getPatientAppointments
);

// Update patient scheduling preferences
router.put('/:patientId/scheduling-preferences',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkResourceOwnership('patient'),
  appointmentController.updatePatientSchedulingPreferences
);

// Self-schedule an appointment (special permission for patients)
router.post('/:patientId/self-schedule',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkResourceOwnership('patient'),
  (req, res, next) => {
    // Automatically set self-scheduled flag
    req.body.selfScheduled = true;
    req.body.patientId = req.params.patientId;
    next();
  },
  appointmentController.createAppointment
);


module.exports = router;
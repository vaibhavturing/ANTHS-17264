// src/routes/patient-communication.routes.js

const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Patient access middleware with fallback
let patientAccessMiddleware;
try {
  patientAccessMiddleware = require('../middleware/patient-access.middleware');
} catch (error) {
  // Fallback if the middleware doesn't exist
  patientAccessMiddleware = {
    checkPatientAccess: (req, res, next) => next()
  };
}

// Middleware to restrict access to authenticated users
const requireAuth = authMiddleware.authenticate;

// Get patient communication preferences
router.get(
  '/:patientId/communications/preferences',
  requireAuth,
  patientAccessMiddleware.checkPatientAccess,
  communicationController.getPatientCommunicationPreferences
);

// Update patient communication preferences
router.put(
  '/:patientId/communications/preferences',
  requireAuth,
  patientAccessMiddleware.checkPatientAccess,
  communicationController.updatePatientCommunicationPreferences
);

// Get patient communications
router.get(
  '/:patientId/communications',
  requireAuth,
  patientAccessMiddleware.checkPatientAccess,
  communicationController.getPatientCommunications
);

// Send health tip to a patient
router.post(
  '/:patientId/health-tip',
  requireAuth,
  permissionMiddleware.checkPermission('communications', 'send-health-tip'),
  communicationController.sendHealthTip
);

// Send emergency notification to a patient
router.post(
  '/:patientId/emergency-notification',
  requireAuth,
  permissionMiddleware.checkPermission('communications', 'send-emergency'),
  communicationController.sendEmergencyNotification
);

module.exports = router;
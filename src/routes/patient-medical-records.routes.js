// src/routes/patient-medical-records.routes.js

const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecord.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { permissionMiddleware } = require('../middleware/permission.middleware');
const patientAccessMiddleware = require('../middleware/patient-access.middleware');


// Import permission middleware with error handling
const getPermissionMiddleware = () => {
  try {
    return require('../middleware/permission.middleware').permissionMiddleware;
  } catch (error) {
    // If the specific permission middleware isn't available, create a placeholder
    return function(permission) {
      return (req, res, next) => next();
    };
  }
};

// Middleware to restrict access to authenticated users with specific permissions
const requireAuth = authMiddleware.authenticate;
const requirePermission = getPermissionMiddleware();

// Get medical records for a patient
router.get(
  '/:patientId/medical-records',
  requireAuth,
  patientAccessMiddleware.checkPatientAccess, // Verify access to patient data
  medicalRecordController.getPatientMedicalRecords
);

// Get medical record timeline for a patient
router.get(
  '/:patientId/medical-records/timeline',
  requireAuth,
  patientAccessMiddleware.checkPatientAccess,
  medicalRecordController.getPatientMedicalRecordTimeline
);


module.exports = router;
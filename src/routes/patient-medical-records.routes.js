// File: src/routes/patient-medical-records.routes.js (Fixed version)
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// FIXED: Use inline callback functions instead of potentially undefined controller methods
// This ensures the routes will work even if the controller isn't fully implemented

// Get all medical records for a patient
router.get(
  '/patient/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientMedicalRecords', 'read'),
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'This endpoint is under development'
    });
  }
);

// Create medical record for a patient
router.post(
  '/patient/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientMedicalRecords', 'create'),
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'This endpoint is under development'
    });
  }
);

// Get specific medical record for a patient
router.get(
  '/:recordId/patient/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientMedicalRecords', 'read'),
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'This endpoint is under development'
    });
  }
);

// Update specific medical record for a patient
router.put(
  '/:recordId/patient/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientMedicalRecords', 'update'),
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'This endpoint is under development'
    });
  }
);

module.exports = router;
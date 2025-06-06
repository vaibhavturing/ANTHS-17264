// src/routes/patient-medical-records.routes.js

const express = require('express');
const router = express.Router();
const medicalRecordController = require('../controllers/medicalRecord.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { permissionMiddleware } = require('../middleware/permission.middleware');
const patientAccessMiddleware = require('../middleware/patient-access.middleware');

// Middleware to restrict access to authenticated users with specific permissions
const requireAuth = authMiddleware.authenticate;
const requirePermission = permissionMiddleware;

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
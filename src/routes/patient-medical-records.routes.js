const express = require('express');
const router = express.Router();
const patientMedicalRecordsController = require('../controllers/patient-medical-records.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Get all medical records for a patient
router.get(
  '/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('medicalRecords', 'read'),
  patientMedicalRecordsController.getPatientMedicalRecords
);

// Create a medical record for a patient
router.post(
  '/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('medicalRecords', 'create'),
  patientMedicalRecordsController.createPatientMedicalRecord
);

// Get a specific medical record for a patient
router.get(
  '/:patientId/:recordId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('medicalRecords', 'read'),
  patientMedicalRecordsController.getPatientMedicalRecordById
);

// Update a specific medical record for a patient
router.put(
  '/:patientId/:recordId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('medicalRecords', 'update'),
  patientMedicalRecordsController.updatePatientMedicalRecord
);

module.exports = router;
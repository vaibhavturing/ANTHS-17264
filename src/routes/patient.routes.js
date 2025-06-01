const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const validate = require('../middleware/validate.middleware');
const patientValidator = require('../validators/patient.validator');
const { auth } = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/async-handler.util');

// Get all patients (with pagination and filtering)
router.get(
  '/',
  auth('view:patients'),
  validate(patientValidator.getPatientsSchema),
  asyncHandler(patientController.getPatients)
);

// Get patient by ID
router.get(
  '/:patientId',
  auth('view:patient'),
  validate(patientValidator.getPatientByIdSchema),
  asyncHandler(patientController.getPatientById)
);

// Create new patient
router.post(
  '/',
  auth('create:patient'),
  validate(patientValidator.createPatientSchema),
  asyncHandler(patientController.createPatient)
);

// Update patient
router.put(
  '/:patientId',
  auth('update:patient'),
  validate(patientValidator.updatePatientSchema),
  asyncHandler(patientController.updatePatient)
);

// Delete patient
router.delete(
  '/:patientId',
  auth('delete:patient'),
  validate(patientValidator.deletePatientSchema),
  asyncHandler(patientController.deletePatient)
);

// Update patient medical condition
router.put(
  '/:patientId/medical-condition',
  auth('update:patient-medical'),
  validate(patientValidator.updateMedicalConditionSchema),
  asyncHandler(patientController.updateMedicalCondition)
);

// Update patient medication
router.put(
  '/:patientId/medication',
  auth('update:patient-medical'),
  validate(patientValidator.updateMedicationSchema),
  asyncHandler(patientController.updateMedication)
);

// Update patient allergy
router.put(
  '/:patientId/allergy',
  auth('update:patient-medical'),
  validate(patientValidator.updateAllergySchema),
  asyncHandler(patientController.updateAllergy)
);

module.exports = router;
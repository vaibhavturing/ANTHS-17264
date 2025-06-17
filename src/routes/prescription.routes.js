const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescription.controller');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const prescriptionValidator = require('../validators/prescription.validator');

// Create a new prescription (draft)
router.post(
  '/',
  auth('create:prescriptions'),
  validate(prescriptionValidator.createPrescription),
  prescriptionController.createPrescription
);

// Get a prescription by ID
router.get(
  '/:id',
  auth('read:prescriptions'),
  prescriptionController.getPrescriptionById
);

// Get prescriptions by doctor
router.get(
  '/doctor/:doctorId',
  auth('read:prescriptions'),
  prescriptionController.getPrescriptionsByDoctor
);

// Get prescriptions by patient
router.get(
  '/patient/:patientId',
  auth('read:prescriptions'),
  prescriptionController.getPrescriptionsByPatient
);

// Update prescription status
router.patch(
  '/:id/status',
  auth('update:prescriptions'),
  validate(prescriptionValidator.updateStatus),
  prescriptionController.updatePrescriptionStatus
);

// Sign prescription
router.post(
  '/:id/sign',
  auth('sign:prescriptions'),
  validate(prescriptionValidator.signPrescription),
  prescriptionController.signPrescription
);

// Transmit prescription
router.post(
  '/:id/transmit',
  auth('transmit:prescriptions'),
  validate(prescriptionValidator.transmitPrescription),
  prescriptionController.transmitPrescription
);

// Check interactions
router.post(
  '/check-interactions',
  auth('read:prescriptions'),
  validate(prescriptionValidator.checkInteractions),
  prescriptionController.checkInteractions
);

// Override warning
router.post(
  '/:id/override-warning',
  auth('override:prescription-warnings'),
  validate(prescriptionValidator.overrideWarning),
  prescriptionController.overrideWarning
);

module.exports = router;
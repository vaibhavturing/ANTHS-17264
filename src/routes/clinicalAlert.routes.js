const express = require('express');
const router = express.Router();
const clinicalAlertController = require('../controllers/clinicalAlert.controller');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const clinicalAlertValidator = require('../validators/clinicalAlert.validator');

// Get patient alerts
router.post(
  '/patient/:patientId',
  auth('read:patients'),
  validate(clinicalAlertValidator.getPatientAlerts),
  clinicalAlertController.getPatientAlerts
);

// Get user preferences
router.get(
  '/preferences',
  auth(),
  clinicalAlertController.getUserPreferences
);

// Update user preferences
router.patch(
  '/preferences',
  auth(),
  validate(clinicalAlertValidator.updateUserPreferences),
  clinicalAlertController.updateUserPreferences
);

// Admin routes for managing alerts
router.get(
  '/',
  auth('read:clinical-alerts'),
  clinicalAlertController.getAlerts
);

router.get(
  '/:id',
  auth('read:clinical-alerts'),
  clinicalAlertController.getAlertById
);

router.post(
  '/',
  auth('create:clinical-alerts'),
  validate(clinicalAlertValidator.createAlert),
  clinicalAlertController.createAlert
);

router.patch(
  '/:id',
  auth('update:clinical-alerts'),
  validate(clinicalAlertValidator.updateAlert),
  clinicalAlertController.updateAlert
);

router.delete(
  '/:id',
  auth('delete:clinical-alerts'),
  clinicalAlertController.deleteAlert
);

// Development route for seeding sample alerts
// In production, this would be removed or secured
router.post(
  '/seed',
  auth('admin'),
  clinicalAlertController.seedSampleAlerts
);

module.exports = router;
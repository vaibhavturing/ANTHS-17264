const express = require('express');
const patientProfileController = require('../controllers/patient-profile.controller');
const authMiddleware = require('../middleware/auth.middleware');
const Validate = require('../middleware/validate.middleware');
const patientProfileValidators = require('../validators/patient-profile.validator');
const rbacMiddleware = require('../middleware/rbac.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

/**
 * Patient profile management routes
 */

// Get patient profile
router.get(
  '/:id/profile',
  rbacMiddleware.check({
    resource: 'patients',
    action: 'read',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  patientProfileController.getProfile
);

// Update patient profile
router.put(
  '/:id/profile',
  rbacMiddleware.check({
    resource: 'patients',
    action: 'update',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  validator(patientProfileValidators.updateProfile),
  patientProfileController.updateProfile
);

// Record vital signs (only healthcare providers can do this)
router.post(
  '/:id/vitals',
  rbacMiddleware.check({ 
    resource: 'patients.vitals', 
    action: 'create',
    requiredRoles: ['doctor', 'nurse', 'admin']
  }),
  validator(patientProfileValidators.recordVitalSigns),
  patientProfileController.recordVitalSigns
);

// Add allergy
router.post(
  '/:id/allergies',
  rbacMiddleware.check({
    resource: 'patients.allergies',
    action: 'create',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  validator(patientProfileValidators.addAllergy),
  patientProfileController.addAllergy
);

// Update allergy
router.put(
  '/:id/allergies/:allergyId',
  rbacMiddleware.check({
    resource: 'patients.allergies',
    action: 'update',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  validator(patientProfileValidators.updateAllergy),
  patientProfileController.updateAllergy
);

// Add medication
router.post(
  '/:id/medications',
  rbacMiddleware.check({
    resource: 'patients.medications',
    action: 'create',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  validator(patientProfileValidators.addMedication),
  patientProfileController.addMedication
);

// Add medical history
router.post(
  '/:id/medical-history',
  rbacMiddleware.check({
    resource: 'patients.medical-history',
    action: 'create',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  validator(patientProfileValidators.addMedicalHistory),
  patientProfileController.addMedicalHistory
);

// Add family medical history
router.post(
  '/:id/family-history',
  rbacMiddleware.check({
    resource: 'patients.family-history',
    action: 'create',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  validator(patientProfileValidators.addFamilyHistory),
  patientProfileController.addFamilyHistory
);

// Update lifestyle information
router.put(
  '/:id/lifestyle',
  rbacMiddleware.check({
    resource: 'patients.lifestyle',
    action: 'update',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  validator(patientProfileValidators.updateLifestyle),
  patientProfileController.updateLifestyle
);

// Upload document
router.post(
  '/:id/documents',
  rbacMiddleware.check({
    resource: 'patients.documents',
    action: 'create',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  patientProfileController.uploadDocument
);

// Download document
router.get(
  '/:id/documents/:documentId',
  rbacMiddleware.check({
    resource: 'patients.documents',
    action: 'read',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  patientProfileController.getDocument
);

// Get profile version history
router.get(
  '/:id/versions',
  rbacMiddleware.check({
    resource: 'patients.versions',
    action: 'read',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  patientProfileController.getProfileVersionHistory
);

// Compare two versions of a profile
router.get(
  '/:id/versions/compare',
  rbacMiddleware.check({
    resource: 'patients.versions',
    action: 'read',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  patientProfileController.compareProfileVersions
);

// Get field history
router.get(
  '/:id/field-history',
  rbacMiddleware.check({
    resource: 'patients.versions',
    action: 'read',
    possession: 'own',
    getOwnerId: (req) => req.params.id
  }),
  patientProfileController.getFieldHistory
);

module.exports = router;
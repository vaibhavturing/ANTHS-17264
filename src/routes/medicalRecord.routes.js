/**
 * Medical Records Routes
 * Handles PHI with strict HIPAA compliance
 */

const express = require('express');
const medicalRecordController = require('../controllers/medical-record.controller');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const medicalRecordValidator = require('../validators/medicalRecord.validator');
const permissionMiddleware = require('../middleware/permission.middleware');

const router = express.Router();

/**
 * @route GET /api/medical-records/patient/:patientId
 * @desc Get medical records for a patient
 * @access Patient self, assigned providers, admin
 */
router.get(
  '/patient/:patientId',
  auth.requirePatientSelfOrProvider('patientId'),
  validate(medicalRecordValidator.getMedicalRecordsQuery),
  medicalRecordController.getPatientMedicalRecords
);

/**
 * @route GET /api/medical-records/:id
 * @desc Get a single medical record by ID
 * @access Patient self, assigned providers, admin
 */
router.get(
  '/:id',
  auth.requirePatientSelfOrProvider('id'),
  medicalRecordController.getMedicalRecordById
);



/**
 * @route POST /api/medical-records
 * @desc Create a new medical record
 * @access Doctors only
 */
router.post(
  '/',
  auth.requireRole('doctor'),
  validate(medicalRecordValidator.createMedicalRecordSchema),
  medicalRecordController.createMedicalRecord
);

/**
 * @route PUT /api/medical-records/:id
 * @desc Update a medical record (with full audit trail)
 * @access Record creator or admin
 */
router.put(
  '/:id',
  auth.requireRecordCreatorOrAdmin('id'),
  validate(medicalRecordValidator.updateMedicalRecordSchema),
  medicalRecordController.updateMedicalRecord
);

/**
 * @route PATCH /api/medical-records/:id
 * @desc Partially update a medical record
 * @access Record creator or admin
 */
router.patch(
  '/:id',
  auth.requireRecordCreatorOrAdmin('id'),
  validate(medicalRecordValidator.partialUpdateMedicalRecordSchema),
  medicalRecordController.partialUpdateMedicalRecord
);

/**
 * @route POST /api/medical-records/:id/attachments
 * @desc Add attachment to medical record
 * @access Record creator, assigned providers, or admin
 */
router.post(
  '/:id/attachments',
  // Replace with an existing middleware or implement requireProviderWithRecordAccess in auth.middleware.js
  auth.requireRecordCreatorOrAdmin('id'), // Example: restrict to record creator or admin
  validate(medicalRecordValidator.addAttachmentSchema),
  medicalRecordController.addAttachment
);

/**
 * @route GET /api/medical-records/:id/attachments/:attachmentId
 * @desc Get an attachment from a medical record
 * @access Patient self, assigned providers, admin
 */
router.get(
  '/:id/attachments/:attachmentId',
  auth.requirePatientSelfOrProvider('id'),
  medicalRecordController.getAttachment
);

/**
 * @route DELETE /api/medical-records/:id/attachments/:attachmentId
 * @desc Remove an attachment from a medical record
 * @access Record creator or admin
 */
router.delete(
  '/:id/attachments/:attachmentId',
  auth.requireRecordCreatorOrAdmin('id'),
  medicalRecordController.removeAttachment
);

/**
 * @route POST /api/medical-records/:id/share
 * @desc Share a medical record with another provider
 * @access Patient self, assigned providers, admin
 */
router.post(
  '/:id/share',
  auth.requirePatientSelfOrProvider('id'),
  validate(medicalRecordValidator.shareRecordSchema),
  medicalRecordController.shareRecord
);

/**
 * @route GET /api/medical-records/:id/access-log
 * @desc Get access log for a medical record
 * @access Patient self or admin
 */
router.get(
  '/:id/access-log',
  // Replace with an existing middleware or implement requirePatientSelfOrAdmin in auth.middleware.js
  auth.requirePatientSelf('id'), // Example: restrict to patient self only, or implement the missing middleware
  medicalRecordController.getRecordAccessLog
);

/**
 * @route POST /api/medical-records/:id/consent
 * @desc Record patient consent for sharing medical record
 * @access Patient self only
 */
router.post(
  '/:id/consent',
  auth.requirePatientSelf('id'),
  validate(medicalRecordValidator.recordConsentSchema),
  medicalRecordController.recordConsent
);

module.exports = router;
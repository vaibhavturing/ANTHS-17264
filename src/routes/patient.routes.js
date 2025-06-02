/**
 * Patient Management Routes
 * Handles patient records, demographics, and care management
 */

const express = require('express');
const patientController = require('../controllers/patient.controller');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const patientValidator = require('../validators/patient.validator');

const router = express.Router();

/**
 * @route GET /api/patients
 * @desc Get a list of patients (paginated, filtered)
 * @access Healthcare providers (doctors, nurses, admin)
 */
router.get(
  '/',
  auth.requireAnyRole(['admin', 'doctor', 'nurse']),
  validate(patientValidator.getPatientsQuery),
  patientController.getPatients
);

/**
 * @route GET /api/patients/:id
 * @desc Get a single patient by ID
 * @access Self (patient), assigned providers, or admin
 */
router.get(
  '/:id',
  auth.requirePatientSelfOrProvider('id'), // Custom middleware for patient record access
  patientController.getPatientById
);

/**
 * @route POST /api/patients
 * @desc Create a new patient record
 * @access Admins, registration staff
 */
router.post(
  '/',
  auth.requireAnyRole(['admin', 'registration']),
  validate(patientValidator.createPatientSchema),
  patientController.createPatient
);

/**
 * @route PUT /api/patients/:id
 * @desc Update a patient's complete profile
 * @access Admin, registration staff
 */
router.put(
  '/:id',
  auth.requireAnyRole(['admin', 'registration']),
  validate(patientValidator.updatePatientSchema),
  patientController.updatePatient
);

/**
 * @route PATCH /api/patients/:id
 * @desc Partially update a patient profile
 * @access Admin, registration staff, assigned providers
 */
router.patch(
  '/:id',
  auth.requirePatientSelfOrProvider('id'),
  validate(patientValidator.partialUpdatePatientSchema),
  patientController.partialUpdatePatient
);

/**
 * @route DELETE /api/patients/:id
 * @desc Delete a patient record (soft delete)
 * @access Admin only
 */
router.delete(
  '/:id',
  auth.requireRole('admin'),
  patientController.deletePatient
);

/**
 * @route GET /api/patients/:id/allergies
 * @desc Get patient allergies
 * @access Patient self, assigned providers, admin
 */
router.get(
  '/:id/allergies',
  auth.requirePatientSelfOrProvider('id'),
  patientController.getPatientAllergies
);

/**
 * @route PUT /api/patients/:id/allergies
 * @desc Update patient allergies
 * @access Doctors, nurses, admin
 */
router.put(
  '/:id/allergies',
  auth.requireAnyRole(['doctor', 'nurse', 'admin']),
  validate(patientValidator.updateAllergiesSchema),
  patientController.updatePatientAllergies
);

/**
 * @route GET /api/patients/:id/medications
 * @desc Get patient medications
 * @access Patient self, assigned providers, admin
 */
router.get(
  '/:id/medications',
  auth.requirePatientSelfOrProvider('id'),
  patientController.getPatientMedications
);

/**
 * @route PUT /api/patients/:id/medications
 * @desc Update patient medications
 * @access Doctors only (prescription authority)
 */
router.put(
  '/:id/medications',
  auth.requireRole('doctor'),
  validate(patientValidator.updateMedicationsSchema),
  patientController.updatePatientMedications
);

/**
 * @route GET /api/patients/:id/insurance
 * @desc Get patient insurance information
 * @access Patient self, billing staff, admin
 */
router.get(
  '/:id/insurance',
  auth.requireAnyRole(['admin', 'billing']),
  patientController.getPatientInsurance
);

/**
 * @route PUT /api/patients/:id/insurance
 * @desc Update patient insurance information
 * @access Billing staff, admin
 */
router.put(
  '/:id/insurance',
  auth.requireAnyRole(['admin', 'billing']),
  validate(patientValidator.updateInsuranceSchema),
  patientController.updatePatientInsurance
);

module.exports = router;
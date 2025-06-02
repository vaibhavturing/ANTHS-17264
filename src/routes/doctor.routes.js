/**
 * Doctor Management Routes
 * Handles healthcare provider profiles, credentials, and availability
 */

const express = require('express');
const doctorController = require('../controllers/doctor.controller');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const doctorValidator = require('../validators/doctor.validator');

const router = express.Router();

/**
 * @route GET /api/doctors
 * @desc Get a list of doctors (paginated, filtered)
 * @access Public with limited info, Full details for staff
 */
router.get(
  '/',
  validate(doctorValidator.getDoctorsQuery),
  doctorController.getDoctors
);

/**
 * @route GET /api/doctors/:id
 * @desc Get a single doctor by ID
 * @access Public (basic info), Self or Admin (full profile)
 */
router.get(
  '/:id',
  doctorController.getDoctorById
);

/**
 * @route GET /api/doctors/specialties
 * @desc Get list of specialties
 * @access Public
 */
router.get(
  '/specialties',
  doctorController.getSpecialties
);

/**
 * @route POST /api/doctors
 * @desc Create a new doctor profile
 * @access Admin only
 */
router.post(
  '/',
  auth.requireRole('admin'),
  validate(doctorValidator.createDoctorSchema),
  doctorController.createDoctor
);

/**
 * @route PUT /api/doctors/:id
 * @desc Update a doctor's complete profile
 * @access Self (doctor) or Admin
 */
router.put(
  '/:id',
  auth.requireSelfOrRole('admin', 'id'),
  validate(doctorValidator.updateDoctorSchema),
  doctorController.updateDoctor
);

/**
 * @route PATCH /api/doctors/:id
 * @desc Partially update a doctor profile
 * @access Self (doctor) or Admin
 */
router.patch(
  '/:id',
  auth.requireSelfOrRole('admin', 'id'),
  validate(doctorValidator.partialUpdateDoctorSchema),
  doctorController.partialUpdateDoctor
);

/**
 * @route DELETE /api/doctors/:id
 * @desc Delete a doctor record (soft delete)
 * @access Admin only
 */
router.delete(
  '/:id',
  auth.requireRole('admin'),
  doctorController.deleteDoctor
);

/**
 * @route PUT /api/doctors/:id/credentials
 * @desc Update doctor credentials
 * @access Doctor self or Admin
 */
router.put(
  '/:id/credentials',
  auth.requireSelfOrRole('admin', 'id'),
  validate(doctorValidator.updateCredentialsSchema),
  doctorController.updateDoctorCredentials
);

/**
 * @route GET /api/doctors/:id/schedule
 * @desc Get doctor schedule and availability
 * @access Any authenticated user
 */
router.get(
  '/:id/schedule',
  auth.authenticate,
  doctorController.getDoctorSchedule 
);

/**
 * @route PUT /api/doctors/:id/schedule
 * @desc Update doctor schedule and availability
 * @access Self (doctor) or Admin
 */
router.put(
  '/:id/schedule',
  auth.requireSelfOrRole('admin', 'id'),
  validate(doctorValidator.updateScheduleSchema),
  doctorController.updateDoctorSchedule
);

/**
 * @route GET /api/doctors/:id/patients
 * @desc Get list of patients assigned to doctor
 * @access Doctor self or Admin
 */
router.get(
  '/:id/patients',
  auth.requireSelfOrRole('admin', 'id'),
  doctorController.getDoctorPatients
);

module.exports = router;
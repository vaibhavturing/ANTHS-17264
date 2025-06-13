const express = require('express');
const availabilityController = require('../controllers/availability.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const availabilityValidator = require('../validators/availability.validator');

const router = express.Router();

// Doctor availability routes
/**
 * @route   GET /api/doctors/:doctorId/availability
 * @desc    Get doctor availability
 * @access  Authenticated
 */
router.get(
  '/doctors/:doctorId/availability',
  authMiddleware(),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  availabilityController.getDoctorAvailability
);

/**
 * @route   PUT /api/doctors/:doctorId/availability/working-hours
 * @desc    Update doctor working hours
 * @access  Admin, Doctor self
 */
router.put(
  '/doctors/:doctorId/availability/working-hours',
  authMiddleware(['admin', 'doctor']),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  validateRequest(availabilityValidator.updateWorkingHours),
  availabilityController.updateWorkingHours
);

/**
 * @route   POST /api/doctors/:doctorId/availability/special-dates
 * @desc    Add or update a special date
 * @access  Admin, Doctor self
 */
router.post(
  '/doctors/:doctorId/availability/special-dates',
  authMiddleware(['admin', 'doctor']),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  validateRequest(availabilityValidator.addSpecialDate),
  availabilityController.addSpecialDate
);

/**
 * @route   DELETE /api/doctors/:doctorId/availability/special-dates/:specialDateId
 * @desc    Remove a special date
 * @access  Admin, Doctor self
 */
router.delete(
  '/doctors/:doctorId/availability/special-dates/:specialDateId',
  authMiddleware(['admin', 'doctor']),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  validateRequest(availabilityValidator.specialDateIdParam, 'params'),
  availabilityController.removeSpecialDate
);

// Leave routes
/**
 * @route   POST /api/doctors/:doctorId/leaves
 * @desc    Create a leave request
 * @access  Admin, Doctor self
 */
router.post(
  '/doctors/:doctorId/leaves',
  authMiddleware(['admin', 'doctor']),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  validateRequest(availabilityValidator.createLeave),
  availabilityController.createLeave
);

/**
 * @route   GET /api/doctors/:doctorId/leaves
 * @desc    Get all leaves for a doctor
 * @access  Admin, Doctor self
 */
router.get(
  '/doctors/:doctorId/leaves',
  authMiddleware(['admin', 'doctor']),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  availabilityController.getDoctorLeaves
);

/**
 * @route   GET /api/leaves/:leaveId
 * @desc    Get leave by ID
 * @access  Admin, Doctor related to leave
 */
router.get(
  '/leaves/:leaveId',
  authMiddleware(),
  validateRequest(availabilityValidator.leaveIdParam, 'params'),
  availabilityController.getLeaveById
);

/**
 * @route   PUT /api/leaves/:leaveId
 * @desc    Update leave request
 * @access  Admin, Doctor related to leave (with restrictions)
 */
router.put(
  '/leaves/:leaveId',
  authMiddleware(),
  validateRequest(availabilityValidator.leaveIdParam, 'params'),
  validateRequest(availabilityValidator.updateLeave),
  availabilityController.updateLeave
);

/**
 * @route   DELETE /api/leaves/:leaveId
 * @desc    Delete leave request
 * @access  Admin, Doctor related to leave (only pending/cancelled)
 */
router.delete(
  '/leaves/:leaveId',
  authMiddleware(),
  validateRequest(availabilityValidator.leaveIdParam, 'params'),
  availabilityController.deleteLeave
);

/**
 * @route   POST /api/leaves/:leaveId/process-appointments
 * @desc    Process affected appointments
 * @access  Admin only
 */
router.post(
  '/leaves/:leaveId/process-appointments',
  authMiddleware(['admin']),
  validateRequest(availabilityValidator.leaveIdParam, 'params'),
  availabilityController.processAffectedAppointments
);

// Break time routes
/**
 * @route   POST /api/doctors/:doctorId/breaks
 * @desc    Create a break time
 * @access  Admin, Doctor self
 */
router.post(
  '/doctors/:doctorId/breaks',
  authMiddleware(['admin', 'doctor']),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  validateRequest(availabilityValidator.createBreakTime),
  availabilityController.createBreakTime
);

/**
 * @route   GET /api/doctors/:doctorId/breaks
 * @desc    Get all break times for a doctor
 * @access  Authenticated
 */
router.get(
  '/doctors/:doctorId/breaks',
  authMiddleware(),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  availabilityController.getDoctorBreakTimes
);

/**
 * @route   PUT /api/breaks/:breakTimeId
 * @desc    Update break time
 * @access  Admin, Doctor related to break
 */
router.put(
  '/breaks/:breakTimeId',
  authMiddleware(),
  validateRequest(availabilityValidator.breakTimeIdParam, 'params'),
  validateRequest(availabilityValidator, 'updateBreakTime'),
  availabilityController.updateBreakTime
);

/**
 * @route   DELETE /api/breaks/:breakTimeId
 * @desc    Delete break time
 * @access  Admin, Doctor related to break
 */
router.delete(
  '/breaks/:breakTimeId',
  authMiddleware(),
  validateRequest(availabilityValidator.breakTimeIdParam, 'params'),
  availabilityController.deleteBreakTime
);

// Availability checking and calendar routes
/**
 * @route   GET /api/doctors/:doctorId/check-availability
 * @desc    Check if a doctor is available
 * @access  Authenticated
 */
router.get(
  '/doctors/:doctorId/check-availability',
  authMiddleware(),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  availabilityController.checkDoctorAvailability
);

/**
 * @route   GET /api/doctors/:doctorId/calendar
 * @desc    Get calendar events for a doctor
 * @access  Authenticated
 */
router.get(
  '/doctors/:doctorId/calendar',
  authMiddleware(),
  validateRequest(availabilityValidator.doctorIdParam, 'params'),
  availabilityController.getDoctorCalendar
);

module.exports = router;
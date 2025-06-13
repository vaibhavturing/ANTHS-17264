const express = require('express');
const router = express.Router();
const recurringAppointmentController = require('../controllers/recurringAppointment.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

/**
 * Recurring appointment routes
 * @route /api/recurring-appointments
 */

// Get recurring series for a specific patient
router.get('/patient/:patientId', 
  authMiddleware.protect, 
  // In a real app, add permission checks to ensure users can only see their own data
  // unless they are admin or the patient's doctor
  recurringAppointmentController.getPatientRecurringSeries
);

// Create new recurring appointment series
router.post('/', 
  authMiddleware.protect, 
  recurringAppointmentController.createRecurringSeries
);

// Get recurring series by ID
router.get('/:id', 
  authMiddleware.protect, 
  recurringAppointmentController.getRecurringSeriesById
);

// Update recurring series
// Use query parameter ?mode=all|thisAndFuture|this to specify update scope
router.put('/:id', 
  authMiddleware.protect, 
  recurringAppointmentController.updateRecurringSeries
);

// Cancel recurring series
// Use query parameter ?mode=all|future to specify cancellation scope
router.post('/:id/cancel', 
  authMiddleware.protect, 
  recurringAppointmentController.cancelRecurringSeries
);

module.exports = router;
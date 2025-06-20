// src/routes/appointment-reminder.routes.js
const express = require('express');
const router = express.Router();
const appointmentReminderController = require('../controllers/appointment-reminder.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { processValidationErrors } = require('../validators/validation.utils');

// Apply authentication middleware to all routes
router.use(authenticate);

// Schedule reminder for a single appointment
router.post(
  '/:appointmentId',
  authorize(['admin', 'doctor', 'receptionist']),
  [
    body('reminderDate')
      .optional()
      .isISO8601()
      .withMessage('reminderDate must be a valid ISO 8601 date')
      .toDate(),
    processValidationErrors
  ],
  appointmentReminderController.scheduleReminder
);

// Schedule batch reminders
router.post(
  '/batch',
  authorize(['admin']),
  [
    body('daysAhead')
      .optional()
      .isInt({ min: 0, max: 30 })
      .withMessage('daysAhead must be between 0 and 30'),
    body('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('limit must be between 1 and 1000'),
    processValidationErrors
  ],
  appointmentReminderController.scheduleBatchReminders
);

// Get reminder queue status (admin only)
router.get(
  '/status',
  authorize(['admin']),
  appointmentReminderController.getReminderQueueStatus
);

// Clean up old reminder jobs (admin only)
router.delete(
  '/cleanup',
  authorize(['admin']),
  [
    body('olderThan')
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage('olderThan must be between 1 and 30 days'),
    processValidationErrors
  ],
  appointmentReminderController.cleanupReminderJobs
);

module.exports = router;
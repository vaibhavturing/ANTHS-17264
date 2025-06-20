// src/routes/report.routes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { processValidationErrors } = require('../validators/validation.utils');

// Apply authentication middleware to all routes
router.use(authenticate);

// Only allow admin and managers to generate reports
router.use(authorize(['admin', 'manager']));

// Generate patient statistics report
router.post(
  '/patient-statistics',
  [
    body('emailTo')
      .optional()
      .isEmail()
      .withMessage('emailTo must be a valid email address'),
    processValidationErrors
  ],
  reportController.generatePatientStatisticsReport
);

// Generate appointment statistics report
router.post(
  '/appointment-statistics',
  [
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date')
      .toDate(),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date')
      .toDate(),
    body('emailTo')
      .optional()
      .isEmail()
      .withMessage('emailTo must be a valid email address'),
    processValidationErrors
  ],
  reportController.generateAppointmentStatisticsReport
);

// Generate doctor workload report
router.post(
  '/doctor-workload',
  [
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date')
      .toDate(),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date')
      .toDate(),
    body('emailTo')
      .optional()
      .isEmail()
      .withMessage('emailTo must be a valid email address'),
    processValidationErrors
  ],
  reportController.generateDoctorWorkloadReport
);

// Get report queue status
router.get(
  '/status',
  reportController.getReportQueueStatus
);

module.exports = router;
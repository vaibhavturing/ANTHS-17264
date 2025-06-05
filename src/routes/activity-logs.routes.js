// File: src/routes/activity-logs.routes.js
// New routes file for activity log endpoints

const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activity-log.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateMiddleware = require('../middleware/validate.middleware');
const activityLogValidator = require('../validators/activity-log.validator');
const activityLoggerMiddleware = require('../middleware/activity-logger.middleware');

// All routes require authentication
router.use(authMiddleware.authenticate);

// Log API activity for all activity-log endpoints
router.use(activityLoggerMiddleware.logApiActivity);

/**
 * @route GET /api/activity-logs/my-activity
 * @description Get current user's activity logs
 * @access Private
 */
router.get(
  '/my-activity',
  validateMiddleware(activityLogValidator.searchLogsSchema, 'query'),
  activityLogController.getMyActivity
);

/**
 * @route GET /api/activity-logs/search
 * @description Search all activity logs (admin only)
 * @access Admin
 */
router.get(
  '/search',
  authMiddleware.requireAdmin,
  validateMiddleware(activityLogValidator.searchLogsSchema, 'query'),
  activityLogController.searchActivityLogs
);

/**
 * @route GET /api/activity-logs/users/:userId
 * @description Get activity logs for a specific user (admin only)
 * @access Admin
 */
router.get(
  '/users/:userId',
  authMiddleware.requireAdmin,
  validateMiddleware(activityLogValidator.searchLogsSchema, 'query'),
  activityLogController.getUserActivity
);

/**
 * @route GET /api/activity-logs/resources/:resourceType/:resourceId
 * @description Get access history for a specific resource
 * @access Admin or Resource Owner
 */
router.get(
  '/resources/:resourceType/:resourceId',
  // Authorization would typically check if user owns this resource
  // or has admin access - implemented in controller
  activityLogController.getResourceAccessHistory
);

/**
 * @route GET /api/activity-logs/compliance-report
 * @description Generate compliance report (admin only)
 * @access Admin
 */
router.get(
  '/compliance-report',
  authMiddleware.requireAdmin,
  validateMiddleware(activityLogValidator.complianceReportSchema, 'query'),
  activityLogController.generateComplianceReport
);

/**
 * @route GET /api/activity-logs/download/:filename
 * @description Download a generated report file (admin only)
 * @access Admin
 */
router.get(
  '/download/:filename',
  authMiddleware.requireAdmin,
  activityLogController.downloadReport
);

/**
 * @route POST /api/activity-logs
 * @description Manually create an activity log (admin only)
 * @access Admin
 */
router.post(
  '/',
  authMiddleware.requireAdmin,
  validateMiddleware(activityLogValidator.createLogSchema),
  activityLogController.createActivityLog
);

module.exports = router;
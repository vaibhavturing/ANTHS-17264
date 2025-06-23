/**
 * Metrics Routes
 * API routes for metrics and monitoring functionality
 */

const express = require('express');
const router = express.Router();
const metricsController = require('../controllers/metrics.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorization.middleware');

/**
 * @route GET /api/metrics/system
 * @description Get system metrics
 * @access Private
 */
router.get(
  '/system',
  authenticate,
  authorize(['metrics:read', 'system:monitor']),
  metricsController.getSystemMetrics
);

/**
 * @route GET /api/metrics/business
 * @description Get business metrics
 * @access Private
 */
router.get(
  '/business',
  authenticate,
  authorize(['metrics:read', 'system:monitor']),
  metricsController.getBusinessMetrics
);

/**
 * @route GET /api/metrics/alerts
 * @description Get active alerts
 * @access Private
 */
router.get(
  '/alerts',
  authenticate,
  authorize(['metrics:read', 'alerts:read']),
  metricsController.getAlerts
);

/**
 * @route POST /api/metrics/alerts/:id/acknowledge
 * @description Acknowledge an alert
 * @access Private
 */
router.post(
  '/alerts/:id/acknowledge',
  authenticate,
  authorize(['alerts:manage']),
  metricsController.acknowledgeAlert
);

/**
 * @route POST /api/metrics/alerts/:id/resolve
 * @description Resolve an alert
 * @access Private
 */
router.post(
  '/alerts/:id/resolve',
  authenticate,
  authorize(['alerts:manage']),
  metricsController.resolveAlert
);

/**
 * @route POST /api/metrics/alerts/test
 * @description Test alert system
 * @access Private
 */
router.post(
  '/alerts/test',
  authenticate,
  authorize(['alerts:manage']),
  metricsController.testAlert
);

/**
 * @route GET /api/metrics/scaling
 * @description Get scaling recommendations
 * @access Private
 */
router.get(
  '/scaling',
  authenticate,
  authorize(['metrics:read', 'system:monitor']),
  metricsController.getScalingRecommendations
);

/**
 * @route GET /api/metrics/records/most-accessed
 * @description Get most accessed medical records
 * @access Private
 */
router.get(
  '/records/most-accessed',
  authenticate,
  authorize(['metrics:read']),
  metricsController.getMostAccessedRecords
);

/**
 * @route GET /api/metrics/doctors/:id/utilization
 * @description Get doctor utilization
 * @access Private
 */
router.get(
  '/doctors/:id/utilization',
  authenticate,
  authorize(['metrics:read']),
  metricsController.getDoctorUtilization
);

module.exports = router;
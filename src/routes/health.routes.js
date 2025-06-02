/**
 * Health Check Routes
 * Provides endpoints for application monitoring and health status
 */

const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

/**
 * @route GET /health/liveness
 * @desc Simple liveness probe to check if the application is running
 * @access Public
 */
router.get('/liveness', healthController.getLivenessStatus);

/**
 * @route GET /health/readiness
 * @desc Readiness probe to check if the application is ready to handle requests
 * @access Public
 */
router.get('/readiness', healthController.getReadinessStatus);

/**
 * @route GET /health/deep
 * @desc Deep health check of all system dependencies
 * @access Public
 */
router.get('/deep', healthController.getDeepHealthStatus);

/**
 * @route GET /health/metrics
 * @desc Get system metrics (CPU, memory, etc.)
 * @access Restricted (Internal use only)
 */
router.get('/metrics', healthController.getSystemMetrics);

module.exports = router;
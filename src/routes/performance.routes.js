/**
 * Performance Routes
 * API routes for performance testing and reporting
 */

const express = require('express');
const router = express.Router();
const performanceController = require('../controllers/performance.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorization.middleware');

/**
 * @route POST /api/performance/benchmark/:scenario
 * @description Run a specific benchmark scenario
 * @access Private (Admin only)
 */
router.post(
  '/benchmark/:scenario',
  authenticate,
  authorize(['admin']),
  performanceController.runBenchmark
);

/**
 * @route POST /api/performance/benchmark/all
 * @description Run all benchmark scenarios
 * @access Private (Admin only)
 */
router.post(
  '/benchmark/all',
  authenticate,
  authorize(['admin']),
  performanceController.runAllBenchmarks
);

/**
 * @route POST /api/performance/load/:scenario
 * @description Run a load test for a specific scenario
 * @access Private (Admin only)
 */
router.post(
  '/load/:scenario',
  authenticate,
  authorize(['admin']),
  performanceController.runLoadTest
);

/**
 * @route GET /api/performance/report
 * @description Generate a performance report
 * @access Private (Admin only)
 */
router.get(
  '/report',
  authenticate,
  authorize(['admin']),
  performanceController.generateReport
);

/**
 * @route GET /api/performance/results/:testName
 * @description Get results for a specific test
 * @access Private (Admin only)
 */
router.get(
  '/results/:testName',
  authenticate,
  authorize(['admin']),
  performanceController.getTestResults
);

/**
 * @route GET /api/performance/tests
 * @description List all benchmark tests
 * @access Private (Admin only)
 */
router.get(
  '/tests',
  authenticate,
  authorize(['admin']),
  performanceController.listTests
);

/**
 * @route GET /api/performance/improvements
 * @description Get optimization improvements
 * @access Private
 */
router.get(
  '/improvements',
  authenticate,
  performanceController.getImprovements
);

module.exports = router;
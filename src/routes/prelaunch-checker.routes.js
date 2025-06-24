// src/routes/prelaunch-checker.routes.js

const express = require('express');
const prelaunchCheckerController = require('../controllers/prelaunch-checker.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/prelaunch-checks
 * @desc    Run all pre-launch checks
 * @access  Admin
 */
router.post('/', authMiddleware.authenticate, prelaunchCheckerController.runAllChecks);

/**
 * @route   GET /api/prelaunch-checks/:deploymentId?
 * @desc    Get check results
 * @access  Admin
 */
router.get('/:deploymentId?', authMiddleware.authenticate, prelaunchCheckerController.getCheckResults);

module.exports = router;
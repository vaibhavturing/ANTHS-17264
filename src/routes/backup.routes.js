// src/routes/backup.routes.js

const express = require('express');
const backupController = require('../controllers/backup.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/backups
 * @desc    Trigger a manual backup
 * @access  Admin
 */
router.post('/', authMiddleware.authenticate, backupController.triggerBackup);

/**
 * @route   GET /api/backups
 * @desc    List available backups
 * @access  Admin
 */
router.get('/', authMiddleware.authenticate, backupController.listBackups);

/**
 * @route   GET /api/backups/:backupId
 * @desc    Get backup status
 * @access  Admin
 */
router.get('/:backupId', authMiddleware.authenticate, backupController.getBackupStatus);

/**
 * @route   GET /api/backups/restore-tests
 * @desc    Get restore test results
 * @access  Admin
 */
router.get('/restore-tests', authMiddleware.authenticate, backupController.getRestoreTestResults);

/**
 * @route   POST /api/backups/restore-tests
 * @desc    Trigger a manual restore test
 * @access  Admin
 */
router.post('/restore-tests', authMiddleware.authenticate, backupController.triggerRestoreTest);

module.exports = router;
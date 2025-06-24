// src/routes/hipaaCompliance.routes.js

const express = require('express');
const hipaaComplianceController = require('../controllers/hipaaCompliance.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * @route   POST /api/hipaa/incidents
 * @desc    Report a privacy/security incident
 * @access  Authenticated
 */
router.post('/incidents', authMiddleware.authenticate, hipaaComplianceController.reportIncident);

/**
 * @route   GET /api/hipaa/incidents/:id
 * @desc    Get incident details
 * @access  Privacy Officer, Admin, Compliance
 */
router.get('/incidents/:id', authMiddleware.authenticate, hipaaComplianceController.getIncident);

/**
 * @route   POST /api/hipaa/incidents/:id/assessment
 * @desc    Perform breach assessment
 * @access  Privacy Officer, Compliance
 */
router.post('/incidents/:id/assessment', authMiddleware.authenticate, hipaaComplianceController.assessIncident);

/**
 * @route   POST /api/hipaa/incidents/:id/notifications/individual
 * @desc    Record individual notification
 * @access  Privacy Officer, Compliance
 */
router.post('/incidents/:id/notifications/individual', authMiddleware.authenticate, hipaaComplianceController.recordIndividualNotification);

/**
 * @route   POST /api/hipaa/incidents/:id/notifications/hhs
 * @desc    Record HHS notification
 * @access  Privacy Officer, Compliance
 */
router.post('/incidents/:id/notifications/hhs', authMiddleware.authenticate, hipaaComplianceController.recordHHSNotification);

/**
 * @route   POST /api/hipaa/reports/compliance
 * @desc    Generate compliance report
 * @access  Admin, Compliance, Privacy Officer
 */
router.post('/reports/compliance', authMiddleware.authenticate, hipaaComplianceController.generateComplianceReport);

/**
 * @route   GET /api/hipaa/training/status/:userId?
 * @desc    Get user training status
 * @access  Self, Admin, HR, Training Manager
 */
router.get('/training/status/:userId?', authMiddleware.authenticate, hipaaComplianceController.getTrainingStatus);

/**
 * @route   POST /api/hipaa/training/completion/:userId?
 * @desc    Record training completion
 * @access  Self, Admin, HR, Training Manager
 */
router.post('/training/completion/:userId?', authMiddleware.authenticate, hipaaComplianceController.recordTrainingCompletion);

module.exports = router;
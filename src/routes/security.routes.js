/**
 * Security Routes
 * File: src/routes/security.routes.js
 * 
 * API routes for security scanning and vulnerability management
 */
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const securityController = require('../controllers/security.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');

// Validation rules
const scanValidationRules = [
  body('scanType')
    .isIn(['automated', 'manual', 'penetration_test', 'code_review', 'dependency_check'])
    .withMessage('Invalid scan type'),
  body('scannerName')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Scanner name is required'),
  body('scanDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
];

const vulnerabilityValidationRules = [
  body('scanId')
    .isMongoId()
    .withMessage('Invalid scan ID'),
  body('vulnerabilities')
    .isArray()
    .withMessage('Vulnerabilities must be an array'),
  body('vulnerabilities.*.title')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Title is required for each vulnerability'),
  body('vulnerabilities.*.description')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Description is required for each vulnerability'),
  body('vulnerabilities.*.severity')
    .isIn(['critical', 'high', 'medium', 'low', 'info'])
    .withMessage('Invalid severity level'),
  body('vulnerabilities.*.cvssScore')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('CVSS Score must be between 0 and 10')
];

const statusUpdateValidationRules = [
  param('id')
    .isMongoId()
    .withMessage('Invalid vulnerability ID'),
  body('status')
    .isIn(['open', 'in_progress', 'fixed', 'wont_fix', 'false_positive'])
    .withMessage('Invalid status')
];

// Security scan routes
router.post(
  '/scans',
  authMiddleware,
  roleMiddleware(['admin', 'security_analyst']),
  scanValidationRules,
  securityController.createScan
);

router.post(
  '/vulnerabilities/batch',
  authMiddleware,
  roleMiddleware(['admin', 'security_analyst']),
  vulnerabilityValidationRules,
  securityController.registerVulnerabilities
);

router.get(
  '/vulnerabilities/report',
  authMiddleware,
  roleMiddleware(['admin', 'security_analyst', 'developer']),
  securityController.getVulnerabilityReport
);

router.patch(
  '/vulnerabilities/:id/status',
  authMiddleware,
  roleMiddleware(['admin', 'security_analyst', 'developer']),
  statusUpdateValidationRules,
  securityController.updateVulnerabilityStatus
);

router.get(
  '/vulnerabilities/prioritized',
  authMiddleware,
  roleMiddleware(['admin', 'security_analyst', 'developer']),
  securityController.getPrioritizedVulnerabilities
);

module.exports = router;
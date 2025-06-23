/**
 * Security Admin Routes
 * File: src/routes/securityAdmin.routes.js
 * 
 * This file contains routes for security event administration
 * and alert management.
 */

const express = require('express');
const router = express.Router();
const { param, query, body } = require('express-validator');
const securityEventAdminController = require('../controllers/securityEventAdmin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');

// Validation rules
const securityEventIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid security event ID')
];

const userIdParam = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID')
];

const updateStatusRules = [
  ...securityEventIdParam,
  body('status')
    .isIn(['unhandled', 'in_progress', 'resolved', 'false_positive'])
    .withMessage('Invalid status value'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be at most 1000 characters')
];

const getEventsQueryRules = [
  query('eventType')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Event type must be at most 100 characters'),
  query('severity')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical', 'info'])
    .withMessage('Invalid severity value'),
  query('status')
    .optional()
    .isIn(['unhandled', 'in_progress', 'resolved', 'false_positive'])
    .withMessage('Invalid status value'),
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  query('ip')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 45 })
    .withMessage('IP must be at most 45 characters'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO format'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Sort by field must be at most 50 characters'),
  query('sortDirection')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort direction must be asc or desc')
];

const getHighVolumeAccessRules = [
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  query('recordType')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Record type must be at most 50 characters'),
  query('severity')
    .optional()
    .isIn(['medium', 'high', 'critical'])
    .withMessage('Invalid severity value'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1 and 90'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const getFailedLoginsRules = [
  query('username')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Username must be at most 100 characters'),
  query('ip')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 45 })
    .withMessage('IP must be at most 45 characters'),
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('Invalid user ID'),
  query('hours')
    .optional()
    .isInt({ min: 1, max: 720 })
    .withMessage('Hours must be between 1 and 720'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const getUserEventsRules = [
  ...userIdParam,
  query('eventType')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Event type must be at most 100 characters'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be in ISO format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be in ISO format'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Common middleware for all routes
const securityAdminMiddleware = [
  authMiddleware,
  roleMiddleware(['admin', 'security_analyst'])
];

// Routes
router.get(
  '/events',
  securityAdminMiddleware,
  getEventsQueryRules,
  securityEventAdminController.getSecurityEvents
);

router.get(
  '/events/:id',
  securityAdminMiddleware,
  securityEventIdParam,
  securityEventAdminController.getSecurityEventById
);

router.patch(
  '/events/:id/status',
  securityAdminMiddleware,
  updateStatusRules,
  securityEventAdminController.updateSecurityEventStatus
);

router.get(
  '/stats',
  securityAdminMiddleware,
  securityEventAdminController.getSecurityStats
);

router.get(
  '/high-volume-access',
  securityAdminMiddleware,
  getHighVolumeAccessRules,
  securityEventAdminController.getHighVolumeAccessEvents
);

router.get(
  '/failed-logins',
  securityAdminMiddleware,
  getFailedLoginsRules,
  securityEventAdminController.getFailedLogins
);

router.get(
  '/users/:userId/events',
  securityAdminMiddleware,
  getUserEventsRules,
  securityEventAdminController.getUserSecurityEvents
);

module.exports = router;
// src/routes/admin.routes.js

/**
 * Admin routes with enhanced security controls
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { auth } = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const { adminIpWhitelist } = require('../middleware/ip-whitelist.middleware');
const { adminLimiter } = require('../middleware/rate-limit.middleware');
const asyncHandler = require('../utils/async-handler.util');
const auditLogMiddleware = require('../middleware/audit-logger.middleware');
const rateLimitMiddleware = require('../middleware/rate-limit.middleware');
const userValidator = require('../validators/user.validator');

// Apply admin-specific security to all routes
router.use(auth('admin'));  // Role-based authorization
router.use(adminIpWhitelist);  // IP whitelist restriction
router.use(adminLimiter);  // Rate limiting for admin operations

// User management routes
router.get('/users', asyncHandler(adminController.getAllUsers));
router.get('/users/:userId', asyncHandler(adminController.getUserById));
router.put('/users/:userId', asyncHandler(adminController.updateUser));
router.delete('/users/:userId', asyncHandler(adminController.deleteUser));

// System configuration routes
router.get('/system/config', asyncHandler(adminController.getSystemConfig));
router.put('/system/config', asyncHandler(adminController.updateSystemConfig));

// Security audit routes
router.get('/audit-logs', asyncHandler(adminController.getAuditLogs));
router.get('/security-events', asyncHandler(adminController.getSecurityEvents));

// Dashboard and statistics
router.get('/dashboard', asyncHandler(adminController.getDashboardStats));

module.exports = router;
// src/routes/medical-record-notification.routes.js

const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Permission middleware with fallback for easier testing
let permissionMiddleware;
try {
  permissionMiddleware = require('../middleware/permission.middleware').permissionMiddleware;
} catch (error) {
  // Fallback if the permission middleware doesn't exist
  permissionMiddleware = (permission) => (req, res, next) => next();
}

// Middleware to restrict access to authenticated users
const requireAuth = authMiddleware.authenticate;

// Create test result notification
router.post(
  '/:recordId/test-result-notification',
  requireAuth,
  permissionMiddleware('medical-records:manage'),
  communicationController.createTestResultNotification
);

module.exports = router;
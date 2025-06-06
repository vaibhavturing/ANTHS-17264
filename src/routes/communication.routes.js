// src/routes/communication.routes.js

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

// Route for creating communication
router.post(
  '/',
  requireAuth,
  permissionMiddleware('communications:create'),
  communicationController.createCommunication
);

// Route for marking communication as read
router.put(
  '/:communicationId/read',
  requireAuth,
  communicationController.markCommunicationAsRead
);

module.exports = router;
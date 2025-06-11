// src/routes/communication.routes.js

const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Middleware to restrict access to authenticated users
const requireAuth = authMiddleware.authenticate;

// Route for creating communication
router.post(
  '/',
  requireAuth,
  permissionMiddleware.checkPermission('communications', 'create'),
  communicationController.createCommunication
);

// Route for marking communication as read
router.put(
  '/:communicationId/read',
  requireAuth,
  communicationController.markCommunicationAsRead
);

module.exports = router;
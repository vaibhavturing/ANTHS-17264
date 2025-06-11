// src/routes/appointment-notification.routes.js

const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Middleware to restrict access to authenticated users
const requireAuth = authMiddleware.authenticate;

// Create appointment reminder
router.post(
  '/:appointmentId/reminder',
  requireAuth,
  permissionMiddleware.checkPermission('appointments', 'manage'),
  communicationController.createAppointmentReminder
);

module.exports = router;
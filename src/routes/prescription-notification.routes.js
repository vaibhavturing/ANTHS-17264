// src/routes/prescription-notification.routes.js

const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Middleware to restrict access to authenticated users
const requireAuth = authMiddleware.authenticate;

// Create prescription refill alert
router.post(
  '/:prescriptionId/refill-alert',
  requireAuth,
  permissionMiddleware.checkPermission('prescriptions', 'manage'),
  communicationController.createPrescriptionRefillAlert
);

module.exports = router;
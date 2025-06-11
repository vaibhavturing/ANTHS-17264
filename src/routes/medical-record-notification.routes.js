// src/routes/medical-record-notification.routes.js

const express = require('express');
const router = express.Router();
const communicationController = require('../controllers/communication.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Middleware to restrict access to authenticated users
const requireAuth = authMiddleware.authenticate;

// Create medical record notification
router.post(
  '/:medicalRecordId/notification',
  requireAuth,
  permissionMiddleware.checkPermission('medical-records', 'manage'),
  communicationController.createMedicalRecordNotification
);

module.exports = router;
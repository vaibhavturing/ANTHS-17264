// src/routes/notification.routes.js

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Middleware to restrict access to authenticated users
const requireAuth = authMiddleware.authenticate;

// Get user's notifications with pagination
router.get(
  '/',
  requireAuth,
  notificationController.getUserNotifications
);

// Get unread notification count
router.get(
  '/count',
  requireAuth,
  notificationController.getUnreadCount
);

// Get latest notifications for quick view
router.get(
  '/latest',
  requireAuth,
  notificationController.getLatestNotifications
);

// Mark a notification as read
router.put(
  '/:notificationId/read',
  requireAuth,
  notificationController.markAsRead
);

// Mark all notifications as read
router.put(
  '/read-all',
  requireAuth,
  notificationController.markAllAsRead
);

// Delete a notification
router.delete(
  '/:notificationId',
  requireAuth,
  notificationController.deleteNotification
);

module.exports = router;
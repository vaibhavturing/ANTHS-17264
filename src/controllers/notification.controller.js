// src/controllers/notification.controller.js

const notificationService = require('../services/notification.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { ValidationError } = require('../utils/errors');
const { notificationQuerySchema } = require('../validators/communication.validator');
const logger = require('../utils/logger');

/**
 * Notification Controller
 * Handles HTTP requests related to in-app notifications
 */
const notificationController = {
  /**
   * Get user's notifications
   * @route GET /api/notifications
   */
  getUserNotifications: asyncHandler(async (req, res) => {
    // Validate query parameters
    const { error, value } = notificationQuerySchema.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid query parameters', error.details);
    }
    
    // Get notifications
    const result = await notificationService.getUserNotifications(
      req.user._id,
      value
    );
    
    return ResponseUtil.success(res, result);
  }),
  
  /**
   * Get unread notification count
   * @route GET /api/notifications/count
   */
  getUnreadCount: asyncHandler(async (req, res) => {
    const count = await notificationService.getUnreadCount(req.user._id);
    
    return ResponseUtil.success(res, { count });
  }),
  
  /**
   * Get latest notifications for quick view
   * @route GET /api/notifications/latest
   */
  getLatestNotifications: asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    const includeRead = req.query.includeRead === 'true';
    
    const notifications = await notificationService.getLatestNotifications(
      req.user._id,
      limit,
      includeRead
    );
    
    return ResponseUtil.success(res, { notifications });
  }),
  
  /**
   * Mark a notification as read
   * @route PUT /api/notifications/:notificationId/read
   */
  markAsRead: asyncHandler(async (req, res) => {
    const notification = await notificationService.markNotificationAsRead(
      req.params.notificationId,
      req.user._id
    );
    
    return ResponseUtil.success(res, { 
      notification,
      message: 'Notification marked as read'
    });
  }),
  
  /**
   * Mark all notifications as read
   * @route PUT /api/notifications/read-all
   */
  markAllAsRead: asyncHandler(async (req, res) => {
    const result = await notificationService.markAllNotificationsAsRead(req.user._id);
    
    return ResponseUtil.success(res, { 
      count: result.count,
      message: `${result.count} notifications marked as read`
    });
  }),
  
  /**
   * Delete a notification
   * @route DELETE /api/notifications/:notificationId
   */
  deleteNotification: asyncHandler(async (req, res) => {
    await notificationService.deleteNotification(
      req.params.notificationId,
      req.user._id
    );
    
    return ResponseUtil.success(res, { 
      message: 'Notification deleted successfully'
    });
  })
};

module.exports = notificationController;
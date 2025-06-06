// src/services/notification.service.js

const { Notification } = require('../models/notification.model');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { NotFoundError } = require('../utils/errors');

/**
 * Notification Service
 * Handles operations related to in-app notifications
 */
const notificationService = {
  /**
   * Get unread notifications count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread notification count
   */
  getUnreadCount: async (userId) => {
    try {
      return await Notification.getUnreadCount(userId);
    } catch (error) {
      logger.error('Error getting unread notification count', {
        error: error.message,
        userId
      });
      throw error;
    }
  },
  
  /**
   * Get latest notifications for a user
   * @param {string} userId - User ID
   * @param {number} limit - Maximum number of notifications to return
   * @param {boolean} includeRead - Whether to include read notifications
   * @returns {Promise<Array>} Notifications list
   */
  getLatestNotifications: async (userId, limit = 10, includeRead = false) => {
    try {
      return await Notification.getLatestNotifications(userId, limit, includeRead);
    } catch (error) {
      logger.error('Error getting latest notifications', {
        error: error.message,
        userId
      });
      throw error;
    }
  },
  
  /**
   * Get all notifications for a user with pagination
   * @param {string} userId - User ID
   * @param {Object} options - Pagination and filter options
   * @returns {Promise<Object>} Paginated notifications
   */
  getUserNotifications: async (userId, options = {}) => {
    try {
      const {
        page = 1,
        limit = 20,
        includeRead = true,
        type,
        startDate,
        endDate
      } = options;
      
      // Build query
      let query = { recipient: userId };
      
      // Filter by read status
      if (!includeRead) {
        query.isRead = false;
      }
      
      // Filter by type
      if (type) {
        query.type = type;
      }
      
      // Filter by date range
      if (startDate || endDate) {
        query.createdAt = {};
        
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }
      
      // Filter out expired notifications
      query = {
        ...query,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } }
        ]
      };
      
      // Count total notifications
      const total = await Notification.countDocuments(query);
      
      // Get paginated notifications
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      return {
        total,
        page,
        pages: Math.ceil(total / limit),
        notifications
      };
    } catch (error) {
      logger.error('Error getting user notifications', {
        error: error.message,
        userId
      });
      throw error;
    }
  },
  
  /**
   * Mark a notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated notification
   */
  markNotificationAsRead: async (notificationId, userId) => {
    try {
      // Find notification and verify ownership
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId
      });
      
      if (!notification) {
        throw new NotFoundError('Notification not found or not accessible');
      }
      
      // Mark as read if not already
      if (!notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date();
        await notification.save();
        
        logger.info(`Notification marked as read`, {
          notificationId,
          userId
        });
      }
      
      return notification;
    } catch (error) {
      logger.error('Error marking notification as read', {
        error: error.message,
        notificationId,
        userId
      });
      throw error;
    }
  },
  
  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result with count of updated notifications
   */
  markAllNotificationsAsRead: async (userId) => {
    try {
      const now = new Date();
      
      // Update all unread notifications
      const result = await Notification.updateMany(
        { 
          recipient: userId,
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: now
          }
        }
      );
      
      logger.info(`Marked all notifications as read for user ${userId}`, {
        updatedCount: result.nModified || result.modifiedCount
      });
      
      return {
        success: true,
        count: result.nModified || result.modifiedCount
      };
    } catch (error) {
      logger.error('Error marking all notifications as read', {
        error: error.message,
        userId
      });
      throw error;
    }
  },
  
  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  createNotification: async (notificationData) => {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      
      logger.info(`Notification created for user ${notificationData.recipient}`, {
        notificationId: notification._id,
        title: notification.title,
        type: notification.type
      });
      
      return notification;
    } catch (error) {
      logger.error('Error creating notification', {
        error: error.message,
        userId: notificationData?.recipient
      });
      throw error;
    }
  },
  
  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result
   */
  deleteNotification: async (notificationId, userId) => {
    try {
      // Find notification and verify ownership
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId
      });
      
      if (!notification) {
        throw new NotFoundError('Notification not found or not accessible');
      }
      
      await notification.remove();
      
      logger.info(`Notification deleted`, {
        notificationId,
        userId
      });
      
      return { success: true };
    } catch (error) {
      logger.error('Error deleting notification', {
        error: error.message,
        notificationId,
        userId
      });
      throw error;
    }
  }
};

module.exports = notificationService;
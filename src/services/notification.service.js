const { Notification } = require('../models/notification.model');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');

/**
 * Service for managing notifications
 */
const notificationService = {
  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Created notification
   */
  createNotification: async (notificationData) => {
    try {
      const notification = new Notification(notificationData);
      await notification.save();
      
      logger.info('Created notification', { 
        notificationId: notification._id, 
        type: notification.type 
      });
      
      return notification;
    } catch (error) {
      logger.error('Error creating notification', { 
        error: error.message,
        notificationData 
      });
      throw error;
    }
  },

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Notifications
   */
  getUserNotifications: async (userId, filters = {}) => {
    try {
      // Build query to find notifications that target this user
      // either directly or by role
      const query = {
        $or: [
          { 'recipients.userIds': userId },
          { 'recipients.roles': { $in: filters.userRoles || [] } }
        ]
      };
      
      // Apply read/unread filter if provided
      if (filters.unreadOnly) {
        query.read = { $ne: userId };
      }
      
      // Apply type filter if provided
      if (filters.type) {
        query.type = filters.type;
      }
      
      // Apply date range filter if provided
      if (filters.startDate) {
        query.createdAt = { $gte: new Date(filters.startDate) };
      }
      
      if (filters.endDate) {
        if (!query.createdAt) query.createdAt = {};
        query.createdAt.$lte = new Date(filters.endDate);
      }
      
      // Apply priority filter if provided
      if (filters.priority) {
        query.priority = filters.priority;
      }
      
      // Get notifications with pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;
      
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      const total = await Notification.countDocuments(query);
      
      return {
        notifications,
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting user notifications', { 
        error: error.message,
        userId,
        filters 
      });
      throw error;
    }
  },

  /**
   * Mark a notification as read for a user
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated notification
   */
  markAsRead: async (notificationId, userId) => {
    try {
      const notification = await Notification.findById(notificationId);
      
      if (!notification) {
        throw new NotFoundError('Notification not found');
      }
      
      // Check if user has already read this notification
      if (!notification.read.includes(userId)) {
        notification.read.push(userId);
        await notification.save();
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
   * @param {Array} userRoles - User roles
   * @returns {Promise<Object>} Result
   */
  markAllAsRead: async (userId, userRoles = []) => {
    try {
      // Find all unread notifications for this user
      const query = {
        read: { $ne: userId },
        $or: [
          { 'recipients.userIds': userId },
          { 'recipients.roles': { $in: userRoles } }
        ]
      };
      
      // Update all matching notifications
      const result = await Notification.updateMany(
        query,
        { $addToSet: { read: userId } }
      );
      
      return { 
        success: true, 
        message: `Marked ${result.nModified} notifications as read` 
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
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Deletion result
   */
  deleteNotification: async (notificationId) => {
    try {
      const result = await Notification.deleteOne({ _id: notificationId });
      
      if (result.deletedCount === 0) {
        throw new NotFoundError('Notification not found');
      }
      
      return { success: true, message: 'Notification deleted successfully' };
    } catch (error) {
      logger.error('Error deleting notification', { 
        error: error.message,
        notificationId 
      });
      throw error;
    }
  }
};

module.exports = notificationService;
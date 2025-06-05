// File: src/services/activity-log.service.js
// New service for handling activity logging

const ActivityLog = require('../models/activity-log.model');
const User = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Service for managing user activity logging and audit trails
 */
const activityLogService = {
  /**
   * Log a user activity with all relevant details
   * 
   * @param {Object} logData - Data to log
   * @param {string} logData.category - Activity category
   * @param {string} logData.action - Specific action performed
   * @param {string} logData.status - Outcome status
   * @param {Object} logData.user - User object (optional)
   * @param {string} logData.userId - User ID (if user object not provided)
   * @param {string} logData.ipAddress - Client IP address
   * @param {string} logData.userAgent - Client user agent
   * @param {string} logData.sessionId - Session ID (optional)
   * @param {string} logData.resourceType - Type of resource affected (optional)
   * @param {string} logData.resourceId - ID of resource affected (optional)
   * @param {string} logData.description - Description of activity
   * @param {Object} logData.details - Additional context (will be sanitized)
   * @param {Object} logData.changes - Before/after changes (will be sanitized)
   * @param {string} logData.reason - Reason provided by user (optional)
   * @returns {Promise<Object>} Created activity log
   */
  createLog: async (logData) => {
    try {
      // Get user details if userId is provided but not user object
      let user = logData.user;
      
      if (!user && logData.userId) {
        user = await User.findById(logData.userId).lean();
      }
      
      // Prepare log entry
      const logEntry = {
        // Map user info if available
        userId: user?._id || logData.userId,
        username: user ? `${user.firstName} ${user.lastName} (${user.email})` : 'Unknown',
        userRole: user?.role || 'Unknown',
        
        // Required fields
        category: logData.category,
        action: logData.action,
        status: logData.status,
        ipAddress: logData.ipAddress || '0.0.0.0',
        description: logData.description,
        
        // Optional fields
        userAgent: logData.userAgent,
        sessionId: logData.sessionId,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        details: logData.details,
        changes: logData.changes,
        reason: logData.reason
      };

      // Create log entry
      return await ActivityLog.addEntry(logEntry);
    } catch (error) {
      logger.error('Failed to create activity log', { 
        error: error.message,
        action: logData?.action
      });
      // Don't throw to prevent disrupting app flow
      return null;
    }
  },

  /**
   * Log changes to an entity by comparing before and after states
   * 
   * @param {Object} params - Parameters
   * @param {Object} params.before - Entity state before changes
   * @param {Object} params.after - Entity state after changes
   * @param {string} params.resourceType - Type of resource
   * @param {string} params.action - Action performed
   * @param {string} params.userId - ID of user making changes
   * @param {string} params.ipAddress - IP address of user
   * @param {string} params.userAgent - User agent of user
   * @returns {Promise<Object>} Created log entry
   */
  logChanges: async ({ before, after, resourceType, action, userId, ipAddress, userAgent }) => {
    try {
      if (!before || !after) {
        logger.warn('Cannot log changes: before or after state missing', {
          resourceType, 
          userId
        });
        return null;
      }

      // Extract the changes
      const changes = {
        before: {},
        after: {}
      };

      // Detect changed fields
      Object.keys(after).forEach(key => {
        // Skip _id and metadata fields
        if (['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
          return;
        }
        
        // Skip if field is an object ID and is the same
        if (after[key]?.toString && before[key]?.toString && 
            after[key].toString() === before[key].toString()) {
          return;
        }
        
        // Skip if values are equal
        if (JSON.stringify(after[key]) === JSON.stringify(before[key])) {
          return;
        }
        
        // Add changed field to the changes object
        changes.before[key] = before[key];
        changes.after[key] = after[key];
      });
      
      // If no changes detected, skip logging
      if (Object.keys(changes.before).length === 0) {
        return null;
      }

      // Create description based on the changes
      const changedFields = Object.keys(changes.before).join(', ');
      const description = `Updated ${resourceType}: ${changedFields} were modified`;
      
      // Create the log entry
      return await activityLogService.createLog({
        category: 'data_modification',
        action,
        status: 'success',
        userId,
        ipAddress,
        userAgent,
        resourceType,
        resourceId: after._id,
        description,
        changes
      });
    } catch (error) {
      logger.error('Failed to log changes', { 
        error: error.message,
        resourceType
      });
      return null;
    }
  },

  /**
   * Get user activity logs with filtering and pagination
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Activity logs with pagination
   */
  getUserActivityLogs: async (options = {}) => {
    try {
      return await ActivityLog.getLogsForUser(options.userId, {
        category: options.category,
        action: options.action,
        status: options.status,
        startDate: options.startDate,
        endDate: options.endDate,
        page: options.page,
        limit: options.limit,
        sort: options.sort || { createdAt: -1 }
      });
    } catch (error) {
      logger.error('Failed to get user activity logs', { 
        error: error.message,
        userId: options.userId
      });
      throw error;
    }
  },

  /**
   * Search activity logs with advanced filtering options
   * 
   * @param {Object} filters - Search filters
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Activity logs with pagination
   */
  searchActivityLogs: async (filters = {}, pagination = {}) => {
    try {
      const query = {};
      
      // Apply filters
      if (filters.userId) query.userId = filters.userId;
      if (filters.category) query.category = filters.category;
      if (filters.action) query.action = filters.action;
      if (filters.status) query.status = filters.status;
      if (filters.resourceType) query.resourceType = filters.resourceType;
      if (filters.resourceId) query.resourceId = filters.resourceId;
      
      // Date range filter
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }
      
      // Text search in description
      if (filters.search) {
        query.$or = [
          { description: { $regex: filters.search, $options: 'i' } },
          { username: { $regex: filters.search, $options: 'i' } }
        ];
      }
      
      // Build sort options
      const sort = {};
      if (filters.sortBy && filters.sortOrder) {
        sort[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
      } else {
        sort.createdAt = -1; // Default sort
      }
      
      // Build pagination options
      const page = parseInt(pagination.page) || 1;
      const limit = parseInt(pagination.limit) || 20;
      const skip = (page - 1) * limit;
      
      // Execute query
      const logs = await ActivityLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email role')
        .lean();
      
      // Get total count for pagination
      const total = await ActivityLog.countDocuments(query);
      
      return {
        logs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to search activity logs', { error: error.message });
      throw error;
    }
  },

  /**
   * Get access history for a specific resource
   * 
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - ID of resource
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Access history with pagination
   */
  getResourceAccessHistory: async (resourceType, resourceId, options = {}) => {
    try {
      return await ActivityLog.getResourceAccessHistory(resourceType, resourceId, options);
    } catch (error) {
      logger.error('Failed to get resource access history', { 
        error: error.message,
        resourceType,
        resourceId
      });
      throw error;
    }
  },

  /**
   * Generate compliance report for a specific time period
   * 
   * @param {Object} options - Report options
   * @returns {Promise<Object>} Compliance report data
   */
  generateComplianceReport: async (options = {}) => {
    try {
      return await ActivityLog.generateComplianceReport({
        startDate: options.startDate,
        endDate: options.endDate,
        format: options.format || 'json'
      });
    } catch (error) {
      logger.error('Failed to generate compliance report', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Clean up expired activity logs based on retention policy
   * 
   * @returns {Promise<Object>} Cleanup result
   */
  cleanupExpiredLogs: async () => {
    try {
      const result = await ActivityLog.cleanupExpiredLogs();
      
      logger.info('Activity log cleanup completed', {
        deletedCount: result.deletedCount || 0
      });
      
      return {
        success: true,
        deletedCount: result.deletedCount || 0
      };
    } catch (error) {
      logger.error('Failed to clean up expired activity logs', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Log login attempt (success or failure)
   * 
   * @param {Object} data - Login attempt data
   * @returns {Promise<Object>} Created log
   */
  logLoginAttempt: async (data) => {
    try {
      return await activityLogService.createLog({
        category: 'authentication',
        action: 'login',
        status: data.success ? 'success' : 'failure',
        userId: data.userId,
        username: data.username,  // For failed logins where user might not exist
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        description: data.success 
          ? `Successful login for ${data.username || data.email}`
          : `Failed login attempt for ${data.username || data.email}`,
        details: {
          reason: data.reason,
          method: data.method || 'password',
          location: data.location
        }
      });
    } catch (error) {
      logger.error('Failed to log login attempt', { error: error.message });
      return null;
    }
  },
  
  /**
   * Log system-level events
   * 
   * @param {Object} data - System event data
   * @returns {Promise<Object>} Created log
   */
  logSystemEvent: async (data) => {
    try {
      return await activityLogService.createLog({
        category: 'system',
        action: data.action,
        status: data.status || 'info',
        description: data.description,
        details: data.details
      });
    } catch (error) {
      logger.error('Failed to log system event', { error: error.message });
      return null;
    }
  }
};

module.exports = activityLogService;
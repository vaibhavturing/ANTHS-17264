// File: src/services/user.service.js
// Updated to include activity logging for user management

const User = require('../models/user.model');
const activityLogService = require('./activity-log.service'); // Add this import
const { NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Service for user management operations
 */
const userService = {
  /**
   * Get all users with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Users with pagination
   */
  getAllUsers: async (options = {}) => {
    try {
      const query = {};
      
      // Apply filters
      if (options.role) query.role = options.role;
      if (options.isActive !== undefined) query.isActive = options.isActive;
      
      // Build pagination
      const page = parseInt(options.page) || 1;
      const limit = parseInt(options.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Get users
      const users = await User.find(query)
        .select('-password')
        .skip(skip)
        .limit(limit)
        .lean();
      
      // Get total count
      const total = await User.countDocuments(query);
      
      // Log the data access if requester info is provided
      if (options.requesterId) {
        await activityLogService.createLog({
          category: 'data_access',
          action: 'list',
          status: 'success',
          userId: options.requesterId,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          resourceType: 'user',
          description: `Listed ${users.length} users`,
          details: {
            filters: options.role ? { role: options.role } : 'none',
            page,
            limit,
            total
          }
        });
      }
      
      return {
        users,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get all users', { error: error.message });
      throw error;
    }
  },

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} User object
   */
  getUserById: async (id, options = {}) => {
    try {
      const user = await User.findById(id).select('-password').lean();
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Log the data access if requester info is provided
      if (options.requesterId) {
        await activityLogService.createLog({
          category: 'data_access',
          action: 'read',
          status: 'success',
          userId: options.requesterId,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
          resourceType: 'user',
          resourceId: id,
          description: `Viewed user profile: ${user.firstName} ${user.lastName}`,
          details: {
            email: user.email,
            role: user.role,
            isActive: user.isActive
          }
        });
      }
      
      return user;
    } catch (error) {
      logger.error('Failed to get user by ID', { error: error.message, userId: id });
      throw error;
    }
  },

  /**
   * Update user profile
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated user
   */
  updateUser: async (id, updateData, options = {}) => {
    try {
      // Get the user before update for comparison
      const userBefore = await User.findById(id).lean();
      
      if (!userBefore) {
        throw new NotFoundError('User not found');
      }
      
      // Prevent updating certain fields
      const safeUpdateData = { ...updateData };
      delete safeUpdateData.password;
      delete safeUpdateData.email; // Email changes should go through a verification process
      
      // Update the user
      const updatedUser = await User.findByIdAndUpdate(
        id,
        { $set: safeUpdateData },
        { new: true, runValidators: true }
      ).select('-password');
      
      // Log the user profile update
      if (options.requesterId) {
        // For self-updates
        if (options.requesterId.toString() === id.toString()) {
          await activityLogService.logChanges({
            before: userBefore,
            after: updatedUser.toObject(),
            resourceType: 'user',
            action: 'update_profile',
            userId: options.requesterId,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
          });
        } 
        // For admin updates of other users
        else {
          await activityLogService.logChanges({
            before: userBefore,
            after: updatedUser.toObject(),
            resourceType: 'user',
            action: 'admin_update_user',
            userId: options.requesterId,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent
          });
        }
      }
      
      logger.info(`User updated: ${id}`, {
        updatedFields: Object.keys(safeUpdateData)
      });
      
      return updatedUser;
    } catch (error) {
      logger.error('Failed to update user', { error: error.message, userId: id });
      throw error;
    }
  },

  /**
   * Delete or deactivate user
   * @param {string} id - User ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Success message
   */
  deleteUser: async (id, options = {}) => {
    try {
      // Get user before deletion/deactivation
      const user = await User.findById(id);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Default to soft delete (deactivation)
      if (options.permanent) {
        // Hard delete - use with caution, usually better to deactivate
        await User.findByIdAndDelete(id);
        
        // Log permanent deletion
        if (options.requesterId) {
          await activityLogService.createLog({
            category: 'user_management',
            action: 'delete_user',
            status: 'success',
            userId: options.requesterId,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            resourceType: 'user',
            resourceId: id,
            description: `Permanently deleted user: ${user.email}`,
            details: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            },
            reason: options.reason
          });
        }
        
        logger.info(`User permanently deleted: ${id}`);
      } else {
        // Soft delete - deactivate the user
        user.isActive = false;
        await user.save();
        
        // Log deactivation
        if (options.requesterId) {
          await activityLogService.createLog({
            category: 'user_management',
            action: 'deactivate_user',
            status: 'success',
            userId: options.requesterId,
            ipAddress: options.ipAddress,
            userAgent: options.userAgent,
            resourceType: 'user',
            resourceId: id,
            description: `Deactivated user account: ${user.email}`,
            details: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            },
            reason: options.reason
          });
        }
        
        logger.info(`User deactivated: ${id}`);
      }
      
      return {
        success: true,
        message: options.permanent 
          ? 'User permanently deleted' 
          : 'User deactivated'
      };
    } catch (error) {
      logger.error('Failed to delete/deactivate user', { error: error.message, userId: id });
      throw error;
    }
  },

  // Additional methods...
};

module.exports = userService;
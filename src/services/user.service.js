// src/services/user.service.js
const { User, Role } = require('../models');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { ObjectId } = mongoose.Types;

/**
 * Service for user management operations
 */
const userService = {
  /**
   * Get all users with pagination and filtering
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated users list and metadata
   */
  getAllUsers: async (options = {}) => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc',
        search = '',
        role = '',
        isActive = '',
        isVerified = ''
      } = options;

      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      const skip = (pageNum - 1) * limitNum;

      // Build query conditions
      const query = {};

      // Add search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Filter by role (string role name or role ID)
      if (role) {
        if (ObjectId.isValid(role)) {
          // If role is a valid ObjectId, filter by roles array
          query.roles = role;
        } else {
          // Otherwise filter by legacy role string field
          query.role = role;
        }
      }

      // Filter by active status
      if (isActive !== '') {
        query.isActive = isActive === 'true';
      }

      // Filter by verification status
      if (isVerified !== '') {
        query.isVerified = isVerified === 'true';
      }

      // Execute query with pagination
      const sortOption = {};
      sortOption[sort] = order === 'asc' ? 1 : -1;

      const users = await User.find(query)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('roles', 'name description level')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum);

      // Get total count for pagination
      const total = await User.countDocuments(query);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(total / limitNum);
      const hasNext = pageNum < totalPages;
      const hasPrev = pageNum > 1;

      logger.info('Users retrieved successfully', { 
        count: users.length,
        total,
        page: pageNum,
        limit: limitNum
      });

      return {
        users,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      logger.error('Error retrieving users', { error: error.message });
      throw error;
    }
  },

  /**
   * Get user by ID
   * @param {string} id - User ID
   * @returns {Promise<Object>} User object
   */
  getUserById: async (id) => {
    try {
      const user = await User.findById(id)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('roles', 'name description level');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error('Error retrieving user by ID', { 
        error: error.message,
        userId: id 
      });
      throw error;
    }
  },

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  createUser: async (userData) => {
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('Email already in use');
      }

      // Handle role assignment
      let roleIds = [];
      if (userData.roles && userData.roles.length > 0) {
        // Verify all roles exist
        const roles = await Role.find({ _id: { $in: userData.roles } });
        if (roles.length !== userData.roles.length) {
          throw new Error('One or more selected roles do not exist');
        }
        roleIds = roles.map(role => role._id);
      } else if (userData.role) {
        // If using the legacy role field, find the corresponding Role document
        const defaultRole = await Role.findOne({ name: userData.role });
        if (defaultRole) {
          roleIds = [defaultRole._id];
        }
      }

      // Create user with roles
      const user = new User({
        ...userData,
        roles: roleIds
      });

      await user.save();

      // Remove sensitive data before returning
      const userObject = user.toObject();
      delete userObject.password;
      delete userObject.passwordResetToken;
      delete userObject.passwordResetExpires;

      logger.info('User created successfully', { userId: user._id });
      return userObject;
    } catch (error) {
      logger.error('Error creating user', { error: error.message });
      throw error;
    }
  },

  /**
   * Update an existing user
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user
   */
  updateUser: async (id, updateData) => {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      // Check email uniqueness if changing email
      if (updateData.email && updateData.email !== user.email) {
        const existingEmail = await User.findOne({ 
          email: updateData.email,
          _id: { $ne: id }
        });
        if (existingEmail) {
          throw new Error('Email already in use by another account');
        }
      }

      // Handle role assignment
      if (updateData.roles && updateData.roles.length > 0) {
        // Verify all roles exist
        const roles = await Role.find({ _id: { $in: updateData.roles } });
        if (roles.length !== updateData.roles.length) {
          throw new Error('One or more selected roles do not exist');
        }
        user.roles = roles.map(role => role._id);
      } else if (updateData.role && updateData.role !== user.role) {
        // If using the legacy role field, find the corresponding Role document
        const newRole = await Role.findOne({ name: updateData.role });
        if (newRole) {
          user.roles = [newRole._id];
        }
        user.role = updateData.role; // Update legacy role field
      }

      // Update user fields
      const updatableFields = [
        'firstName', 'lastName', 'email', 'isActive', 
        'isVerified', 'phoneNumber', 'address'
      ];
      
      updatableFields.forEach(field => {
        if (updateData[field] !== undefined) {
          user[field] = updateData[field];
        }
      });
      
      // Update password if provided
      if (updateData.password) {
        user.password = updateData.password;
      }

      await user.save();

      // Get updated user without sensitive fields
      const updatedUser = await User.findById(id)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('roles', 'name description level');

      logger.info('User updated successfully', { userId: id });
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user', { 
        error: error.message,
        userId: id 
      });
      throw error;
    }
  },

  /**
   * Delete a user
   * @param {string} id - User ID
   * @returns {Promise<boolean>} Success indicator
   */
  deleteUser: async (id) => {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      // In a real application, consider soft delete or archiving
      // especially for healthcare data due to compliance requirements
      await User.deleteOne({ _id: id });
      
      logger.info('User deleted successfully', { userId: id });
      return true;
    } catch (error) {
      logger.error('Error deleting user', { 
        error: error.message,
        userId: id 
      });
      throw error;
    }
  },

  /**
   * Toggle user activation status
   * @param {string} id - User ID
   * @returns {Promise<Object>} Updated user
   */
  toggleActivation: async (id) => {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      // Toggle active status
      user.isActive = !user.isActive;
      
      await user.save();

      // Get current active status for logging
      const action = user.isActive ? 'activated' : 'deactivated';
      logger.info(`User ${action}`, { userId: id });

      // Return user without sensitive data
      const updatedUser = await User.findById(id)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('roles', 'name description level');

      return updatedUser;
    } catch (error) {
      logger.error('Error toggling user activation', { 
        error: error.message,
        userId: id 
      });
      throw error;
    }
  },

  /**
   * Change user roles
   * @param {string} id - User ID
   * @param {Array} roleIds - Array of role IDs to assign
   * @returns {Promise<Object>} Updated user
   */
  updateUserRoles: async (id, roleIds) => {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify all roles exist
      const roles = await Role.find({ _id: { $in: roleIds } });
      if (roles.length !== roleIds.length) {
        throw new Error('One or more selected roles do not exist');
      }

      // Assign new roles
      user.roles = roleIds;
      
      // Update the legacy role field with the highest-level role
      if (roles.length > 0) {
        const primaryRole = roles.sort((a, b) => b.level - a.level)[0];
        user.role = primaryRole.name;
      }
      
      await user.save();

      // Return user with populated roles
      const updatedUser = await User.findById(id)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('roles', 'name description level');

      logger.info('User roles updated', { 
        userId: id,
        newRoles: roleIds
      });
      
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user roles', { 
        error: error.message,
        userId: id,
        roleIds 
      });
      throw error;
    }
  },

  /**
   * Perform bulk operations on users
   * @param {string} operation - Operation type (activate, deactivate, delete, assignRole)
   * @param {Array<string>} userIds - Array of user IDs
   * @param {Object} options - Additional options (e.g. roleId for assignRole)
   * @returns {Promise<Object>} Operation results
   */
  bulkUserOperation: async (operation, userIds, options = {}) => {
    try {
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new Error('User IDs array is required');
      }

      const results = {
        successful: [],
        failed: [],
        total: userIds.length
      };

      // Use a switch statement to handle different operations
      switch (operation) {
        case 'activate':
          // Activate users
          const activateResult = await User.updateMany(
            { _id: { $in: userIds }, isActive: false },
            { $set: { isActive: true } }
          );
          
          results.successful = activateResult.modifiedCount;
          results.failed = userIds.length - activateResult.modifiedCount;
          
          logger.info('Bulk user activation performed', { 
            total: userIds.length,
            successful: results.successful
          });
          break;
          
        case 'deactivate':
          // Deactivate users
          const deactivateResult = await User.updateMany(
            { _id: { $in: userIds }, isActive: true },
            { $set: { isActive: false } }
          );
          
          results.successful = deactivateResult.modifiedCount;
          results.failed = userIds.length - deactivateResult.modifiedCount;
          
          logger.info('Bulk user deactivation performed', { 
            total: userIds.length,
            successful: results.successful
          });
          break;
          
        case 'delete':
          // Delete users
          const deleteResult = await User.deleteMany({ 
            _id: { $in: userIds } 
          });
          
          results.successful = deleteResult.deletedCount;
          results.failed = userIds.length - deleteResult.deletedCount;
          
          logger.info('Bulk user deletion performed', { 
            total: userIds.length,
            successful: results.successful
          });
          break;
          
        case 'assignRole':
          if (!options.roleId) {
            throw new Error('Role ID is required for assignRole operation');
          }
          
          // Verify role exists
          const role = await Role.findById(options.roleId);
          if (!role) {
            throw new Error('Role not found');
          }
          
          // Assign role to users
          const assignRolePromises = userIds.map(async userId => {
            try {
              const user = await User.findById(userId);
              if (!user) return { success: false, userId, error: 'User not found' };
              
              // Make sure the role isn't already assigned
              if (!user.roles.some(r => r.toString() === options.roleId)) {
                user.roles.push(options.roleId);
                // Update legacy role field if this is a higher level role
                if (role.level > user.roles.reduce((max, r) => Math.max(max, r.level || 0), 0)) {
                  user.role = role.name;
                }
                await user.save();
              }
              
              return { success: true, userId };
            } catch (error) {
              return { success: false, userId, error: error.message };
            }
          });
          
          const roleResults = await Promise.all(assignRolePromises);
          results.successful = roleResults.filter(r => r.success).map(r => r.userId);
          results.failed = roleResults.filter(r => !r.success).map(r => ({ 
            userId: r.userId, 
            reason: r.error 
          }));
          
          logger.info('Bulk role assignment performed', { 
            roleId: options.roleId,
            total: userIds.length,
            successful: results.successful.length
          });
          break;
          
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      return results;
    } catch (error) {
      logger.error('Error in bulk user operation', { 
        error: error.message,
        operation,
        userIds: userIds.length
      });
      throw error;
    }
  },

  /**
   * Get users with admin role
   * @returns {Promise<Array>} List of admin users
   */
  getAdminUsers: async () => {
    try {
      // Find the admin role
      const adminRole = await Role.findOne({ name: 'admin' });
      if (!adminRole) {
        return [];
      }

      // Find users with this role
      const adminUsers = await User.find({ roles: adminRole._id })
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('roles', 'name description level');

      return adminUsers;
    } catch (error) {
      logger.error('Error retrieving admin users', { 
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Search users with advanced filtering
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Array>} Matching users
   */
  searchUsers: async (searchParams = {}) => {
    try {
      const {
        search = '',
        roles = [],
        isActive,
        isVerified,
        createdAfter,
        createdBefore,
        sort = 'createdAt',
        order = 'desc',
        limit = 100
      } = searchParams;

      // Build query
      const query = {};
      
      // Text search across multiple fields
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Role filtering
      if (roles && roles.length > 0) {
        query.roles = { $in: roles };
      }
      
      // Active status
      if (isActive !== undefined) {
        query.isActive = isActive;
      }
      
      // Verification status
      if (isVerified !== undefined) {
        query.isVerified = isVerified;
      }
      
      // Date range for creation
      if (createdAfter || createdBefore) {
        query.createdAt = {};
        if (createdAfter) {
          query.createdAt.$gte = new Date(createdAfter);
        }
        if (createdBefore) {
          query.createdAt.$lte = new Date(createdBefore);
        }
      }
      
      // Execute search
      const sortOption = {};
      sortOption[sort] = order === 'asc' ? 1 : -1;
      
      const users = await User.find(query)
        .select('-password -passwordResetToken -passwordResetExpires')
        .populate('roles', 'name description level')
        .sort(sortOption)
        .limit(parseInt(limit, 10));
      
      logger.info('User search executed', {
        matchCount: users.length,
        searchCriteria: Object.keys(searchParams)
      });
      
      return users;
    } catch (error) {
      logger.error('Error searching users', { 
        error: error.message,
        searchParams 
      });
      throw error;
    }
  }
};

module.exports = userService;
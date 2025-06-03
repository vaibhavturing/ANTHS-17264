// src/services/profile.service.js

const User = require('../models/user.model');
const fs = require('fs');
const path = require('path');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);

// Define error classes inline
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthorizationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = 403;
    Error.captureStackTrace(this, this.constructor);
  }
}

class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Audit logging function
const auditLog = (data) => {
  console.log('[AUDIT]', JSON.stringify(data));
};

class ProfileService {
  /**
   * Get a user's profile by ID
   * @param {string} userId - User ID to retrieve
   * @param {Object} requestingUser - User making the request
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(userId, requestingUser) {
    try {
      // Check if the requesting user is authorized
      if (requestingUser._id.toString() !== userId && requestingUser.role !== 'admin') {
        throw new AuthorizationError('You do not have permission to view this profile');
      }

      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Return user data in client-safe format
      return user.toClientJSON();
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error retrieving user profile', error);
    }
  }

  /**
   * Update a user's profile
   * @param {string} userId - User ID to update
   * @param {Object} updateData - Profile data to update
   * @param {Object} requestingUser - User making the request
   * @returns {Promise<Object>} Updated user profile
   */
  async updateProfile(userId, updateData, requestingUser) {
    try {
      // Check if the requesting user is authorized
      if (requestingUser._id.toString() !== userId && requestingUser.role !== 'admin') {
        throw new AuthorizationError('You do not have permission to update this profile');
      }

      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Only update allowed fields based on user role
      const allowedFields = this._getAllowedUpdateFields(user.role);
      
      // Apply updates to allowed fields only
      Object.keys(updateData).forEach(field => {
        if (allowedFields.includes(field)) {
          // Handle nested objects for fields like emergencyContact
          if (typeof updateData[field] === 'object' && !Array.isArray(updateData[field]) && field !== 'dateOfBirth') {
            if (!user[field]) user[field] = {};
            
            Object.keys(updateData[field]).forEach(nestedField => {
              user[field][nestedField] = updateData[field][nestedField];
            });
          } else {
            user[field] = updateData[field];
          }
        }
      });
      
      // Save updated user
      await user.save();
      
      // Log profile update audit event
      auditLog({
        action: 'PROFILE_UPDATE',
        actor: { 
          id: requestingUser._id, 
          email: requestingUser.email,
          role: requestingUser.role
        },
        resource: 'User',
        resourceId: user._id,
        details: {
          updatedFields: Object.keys(updateData),
          isAdminAction: requestingUser._id.toString() !== userId
        }
      });
      
      // Return updated user data
      return user.toClientJSON();
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof AuthorizationError ||
          error instanceof ValidationError) {
        throw error;
      } else if (error.name === 'ValidationError') {
        throw new ValidationError('Validation error', error.errors);
      }
      throw new DatabaseError('Error updating user profile', error);
    }
  }

  /**
   * Handle profile picture upload
   * @param {string} userId - User ID
   * @param {Object} fileData - Uploaded file data
   * @param {Object} requestingUser - User making the request
   * @returns {Promise<Object>} Updated user profile
   */
  async updateProfilePicture(userId, fileData, requestingUser) {
    try {
      // Check if the requesting user is authorized
      if (requestingUser._id.toString() !== userId && requestingUser.role !== 'admin') {
        throw new AuthorizationError('You do not have permission to update this profile picture');
      }

      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Delete old profile picture if it exists
      if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
        try {
          const oldFilePath = path.join(__dirname, '../../public', user.avatarUrl);
          await unlinkAsync(oldFilePath);
        } catch (err) {
          // Ignore errors if file doesn't exist
          console.log('Could not delete old profile picture:', err.message);
        }
      }
      
      // Update avatar URL
      user.avatarUrl = `/uploads/profile/${fileData.filename}`;
      await user.save();
      
      // Log profile picture update audit event
      auditLog({
        action: 'PROFILE_PICTURE_UPDATE',
        actor: { 
          id: requestingUser._id, 
          email: requestingUser.email,
          role: requestingUser.role
        },
        resource: 'User',
        resourceId: user._id,
        details: {
          filename: fileData.filename,
          isAdminAction: requestingUser._id.toString() !== userId
        }
      });
      
      // Return updated user data
      return user.toClientJSON();
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof AuthorizationError) {
        throw error;
      }
      throw new DatabaseError('Error updating profile picture', error);
    }
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {Object} passwordData - Password change data
   * @param {string} passwordData.currentPassword - Current password
   * @param {string} passwordData.newPassword - New password
   * @param {Object} requestingUser - User making the request
   * @returns {Promise<boolean>} Success status
   */
  async changePassword(userId, { currentPassword, newPassword }, requestingUser) {
    try {
      // Check if the requesting user is authorized
      if (requestingUser._id.toString() !== userId && requestingUser.role !== 'admin') {
        throw new AuthorizationError('You do not have permission to change this user\'s password');
      }

      // Find the user with password field
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // For admin users, we might skip current password validation
      // But for security, we still require it for self-updates
      if (requestingUser._id.toString() === userId) {
        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        
        if (!isPasswordValid) {
          throw new ValidationError('Current password is incorrect');
        }
      }
      
      // Set new password
      user.password = newPassword;
      
      // Increment token version to invalidate all existing sessions
      if (typeof user.incrementTokenVersion === 'function') {
        user.incrementTokenVersion();
      }
      
      await user.save();
      
      // Log password change audit event
      auditLog({
        action: 'PASSWORD_CHANGE',
        actor: { 
          id: requestingUser._id, 
          email: requestingUser.email,
          role: requestingUser.role
        },
        resource: 'User',
        resourceId: user._id,
        details: {
          isAdminAction: requestingUser._id.toString() !== userId
        }
      });
      
      return true;
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof AuthorizationError ||
          error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Error changing password', error);
    }
  }

  /**
   * Delete user account (soft delete)
   * @param {string} userId - User ID to delete
   * @param {Object} requestingUser - User making the request
   * @returns {Promise<boolean>} Success status
   */
  async deleteUserAccount(userId, requestingUser) {
    try {
      // Only admin or the user themselves can delete an account
      if (requestingUser._id.toString() !== userId && requestingUser.role !== 'admin') {
        throw new AuthorizationError('You do not have permission to delete this account');
      }

      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Check if already deleted
      if (user.isDeleted) {
        throw new ValidationError('Account is already deleted');
      }
      
      // Soft delete
      user.isDeleted = true;
      user.deletedAt = new Date();
      
      // Invalidate all sessions
      if (typeof user.incrementTokenVersion === 'function') {
        user.incrementTokenVersion();
      }
      
      await user.save();
      
      // Log account deletion audit event
      auditLog({
        action: 'ACCOUNT_DELETE',
        actor: { 
          id: requestingUser._id, 
          email: requestingUser.email,
          role: requestingUser.role
        },
        resource: 'User',
        resourceId: user._id,
        details: {
          isAdminAction: requestingUser._id.toString() !== userId
        }
      });
      
      return true;
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof AuthorizationError ||
          error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Error deleting user account', error);
    }
  }

  /**
   * Get allowed fields for profile update based on role
   * @param {string} role - User role
   * @returns {Array} List of allowed fields
   * @private
   */
  _getAllowedUpdateFields(role) {
    // Base fields that all users can update
    const baseFields = ['firstName', 'lastName', 'phoneNumber', 'dateOfBirth'];
    
    // Role-specific additional fields
    switch (role) {
      case 'patient':
        return [
          ...baseFields,
          'insuranceProvider',
          'insuranceId',
          'emergencyContact'
        ];
      case 'doctor':
        return [
          ...baseFields,
          'licenseNumber',
          'specialties',
          'yearsOfExperience',
          'department',
          'education',
          'availability',
          'bio'
        ];
      case 'nurse':
        return [
          ...baseFields,
          'nursingLicense',
          'department',
          'certifications',
          'education'
        ];
      case 'admin':
        return [
          ...baseFields,
          'department',
          'jobTitle'
        ];
      default:
        return baseFields;
    }
  }
}

module.exports = new ProfileService();
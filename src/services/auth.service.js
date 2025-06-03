// src/services/auth.service.js

const User = require('../models/user.model');
const crypto = require('crypto');

// Define error classes inline to avoid dependencies
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthenticationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.details = details;
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

class BusinessLogicError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'BusinessLogicError';
    this.statusCode = 422;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Simple logging function for audit (can be replaced with your actual audit logger)
const auditLog = (data) => {
  console.log('[AUDIT]', JSON.stringify(data));
};

// Simple token generator if not using jwt
const generateToken = (payload, expiresIn = '1h') => {
  return { token: crypto.randomBytes(32).toString('hex'), expiresAt: Date.now() + 3600000 };
};

class AuthService {
  /**
   * Register a new user with role-specific validation
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Newly created user
   */
  async register(userData) {
    try {
      // Check if email already exists (this pre-check can help provide a clearer error)
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new ValidationError('Email is already registered');
      }

      // Create new user
      const user = new User(userData);
      
      // Generate email verification token if the method exists
      if (typeof user.generateEmailVerificationToken === 'function') {
        user.generateEmailVerificationToken();
      }
      
      // Save user to database
      await user.save();
      
      // Log registration audit event
      auditLog({
        action: 'USER_REGISTER',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id,
        details: {
          role: user.role,
          emailVerified: user.emailVerified
        }
      });
      
      // Return user data without sensitive information
      // Check if toClientJSON method exists
      if (typeof user.toClientJSON === 'function') {
        return user.toClientJSON();
      }
      
      // Fallback if method doesn't exist
      return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      };
    } catch (error) {
      // Handle different types of errors
      if (error.name === 'ValidationError') {
        throw new ValidationError('Validation error', error);
      } else if (error.code === 11000) {
        throw new ValidationError('Email is already registered');
      } else if (error instanceof ValidationError || 
                error instanceof AuthenticationError || 
                error instanceof BusinessLogicError) {
        throw error;
      } else {
        throw new DatabaseError('Error registering new user', error);
      }
    }
  }

  /**
   * Verify a user's email address
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} Updated user
   */
  async verifyEmail(token) {
    try {
      // Find user by verification token
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new ValidationError('Invalid or expired verification token');
      }

      // Update user verification status
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      
      await user.save();
      
      // Log email verification audit event
      auditLog({
        action: 'EMAIL_VERIFY',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id
      });
      
      // Return user data
      if (typeof user.toClientJSON === 'function') {
        return user.toClientJSON();
      }
      
      return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Error verifying email', error);
    }
  }

  /**
   * Request password reset email
   * @param {string} email - User email address
   * @returns {Promise<boolean>} Success status
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email });
      
      // Even if user not found, return success to prevent email enumeration
      if (!user) return true;
      
      // Generate reset token if the method exists
      if (typeof user.generatePasswordResetToken === 'function') {
        user.generatePasswordResetToken();
        await user.save();
      }
      
      // TODO: Send password reset email
      
      // Log password reset request audit event
      auditLog({
        action: 'PASSWORD_RESET_REQUEST',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id
      });
      
      return true;
    } catch (error) {
      throw new DatabaseError('Error requesting password reset', error);
    }
  }

  /**
   * Reset password with token
   * @param {string} token - Password reset token
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Success status
   */
  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      
      // Reset failed login attempts
      user.failedLoginAttempts = 0;
      user.accountLocked = false;
      user.accountLockedUntil = undefined;
      
      await user.save();
      
      // Log password reset audit event
      auditLog({
        action: 'PASSWORD_RESET',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id
      });
      
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Error resetting password', error);
    }
  }
}

module.exports = new AuthService();
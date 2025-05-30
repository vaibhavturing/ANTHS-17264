/**
 * Healthcare Management Application
 * Authentication Service
 * 
 * Service for handling user authentication, registration, 
 * password management, and session handling
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { User, ROLES } = require('../models/user.model');
const { 
  generateToken, 
  hashToken, 
  generateRandomToken 
} = require('../utils/auth.util');
const { 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError,
  ConflictError 
} = require('../utils/api-error.util');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object} New user and token
 */
const registerUser = async (userData) => {
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new ConflictError('Email already in use');
    }
    
    // Create verification token
    const emailVerificationToken = generateRandomToken();
    const hashedToken = hashToken(emailVerificationToken);
    
    // Create new user
    const user = await User.create({
      ...userData,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ) // 24 hours
    });
    
    // Generate JWT
    const token = generateToken({ id: user._id });
    
    // Remove password from response
    user.password = undefined;
    
    // Return user and token
    return {
      user,
      token,
      emailVerificationToken // Would be sent via email in production
    };
  } catch (error) {
    logger.error(`User registration failed: ${error.message}`);
    throw error;
  }
};

/**
 * Login user
 * @param {String} email - User email
 * @param {String} password - User password
 * @returns {Object} User and token
 */
const loginUser = async (email, password) => {
  try {
    // Check if email and password exist
    if (!email || !password) {
      throw new BadRequestError('Please provide email and password');
    }
    
    // Find user by email and include the password field for verification
    const user = await User.findOne({ email }).select('+password +failedLoginAttempts +accountLocked +lockedUntil');
    
    // Check if user exists
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }
    
    // Check if account is locked
    if (user.accountLocked) {
      // Check if lock period has expired
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedError(
          `Account locked. Please try again after ${user.lockedUntil.toLocaleString()}`
        );
      } else if (user.lockedUntil && user.lockedUntil <= new Date()) {
        // Unlock account if lock period has expired
        user.accountLocked = false;
        user.failedLoginAttempts = 0;
        user.lockedUntil = undefined;
        await user.save({ validateBeforeSave: false });
      } else {
        throw new UnauthorizedError('Account locked. Please contact administrator.');
      }
    }
    
    // Check if password is correct
    const isPasswordCorrect = await user.comparePassword(password);
    
    if (!isPasswordCorrect) {
      // Increment failed login attempts
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      
      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {
        user.accountLocked = true;
        user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        await user.save({ validateBeforeSave: false });
        
        throw new UnauthorizedError(
          'Too many failed login attempts. Account locked for 30 minutes.'
        );
      }
      
      await user.save({ validateBeforeSave: false });
      throw new UnauthorizedError('Invalid email or password');
    }
    
    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      await user.save({ validateBeforeSave: false });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    
    // Generate JWT token
    const token = generateToken({ id: user._id });
    
    // Remove sensitive data from response
    user.password = undefined;
    user.failedLoginAttempts = undefined;
    
    return { user, token };
  } catch (error) {
    logger.error(`Login failed: ${error.message}`);
    throw error;
  }
};

/**
 * Verify email with token
 * @param {String} token - Email verification token
 * @returns {Boolean} Success status
 */
const verifyEmail = async (token) => {
  try {
    const hashedToken = hashToken(token);
    
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      throw new BadRequestError('Token is invalid or has expired');
    }
    
    // Update user
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });
    
    return true;
  } catch (error) {
    logger.error(`Email verification failed: ${error.message}`);
    throw error;
  }
};

/**
 * Send password reset token
 * @param {String} email - User email
 * @returns {String} Reset token (in production, this would be sent via email)
 */
const forgotPassword = async (email) => {
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      // For security reasons, don't reveal if email exists
      throw new NotFoundError('No user with that email address');
    }
    
    // Generate reset token
    const resetToken = generateRandomToken();
    
    // Hash token and store in database
    user.passwordResetToken = hashToken(resetToken);
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    await user.save({ validateBeforeSave: false });
    
    return resetToken; // In production, would be sent via email
  } catch (error) {
    logger.error(`Forgot password failed: ${error.message}`);
    throw error;
  }
};

/**
 * Reset password with token
 * @param {String} token - Password reset token
 * @param {String} newPassword - New password
 * @returns {Boolean} Success status
 */
const resetPassword = async (token, newPassword) => {
  try {
    const hashedToken = hashToken(token);
    
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      throw new BadRequestError('Token is invalid or has expired');
    }
    
    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = Date.now();
    
    await user.save();
    
    return true;
  } catch (error) {
    logger.error(`Reset password failed: ${error.message}`);
    throw error;
  }
};

/**
 * Change current user password
 * @param {String} userId - User ID
 * @param {String} currentPassword - Current password
 * @param {String} newPassword - New password
 * @returns {Boolean} Success status
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  try {
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    // Verify current password
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    
    if (!isPasswordCorrect) {
      throw new UnauthorizedError('Current password is incorrect');
    }
    
    // Update password
    user.password = newPassword;
    user.passwordChangedAt = Date.now();
    
    await user.save();
    
    return true;
  } catch (error) {
    logger.error(`Change password failed: ${error.message}`);
    throw error;
  }
};

module.exports = {
  registerUser,
  loginUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword
};
// src/services/password.service.js

const crypto = require('crypto');
const User = require('../models/user.model');
const emailService = require('./email.service');
const tokenUtil = require('../utils/token.util');
const config = require('../config/config');
const logger = require('../utils/logger');
const { 
  NotFoundError, 
  AuthenticationError, 
  BusinessLogicError 
} = require('../utils/errors');

/**
 * Service for password reset functionality 
 */
const passwordService = {
  /**
   * Request a password reset and send email with reset link
   * @param {string} email - User's email address
   * @returns {Promise<Object>} Success message
   */
  requestPasswordReset: async (email) => {
    try {
      // Find the user by email
      const user = await User.findOne({ email });
      
      // We don't reveal if the email exists for security reasons
      // Just return a generic success message
      if (!user) {
        logger.info(`Password reset requested for non-existent email: ${email}`);
        return { 
          success: true, 
          message: 'If your email is registered, you will receive a password reset link shortly' 
        };
      }
      
      // Generate a reset token
      const resetToken = tokenUtil.generateResetToken();
      const hashedToken = tokenUtil.hashToken(resetToken);
      
      // Store the hashed token in the database with expiration
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = tokenUtil.calculateExpiryTime(60); // 60 minutes
      
      // Save the user with the reset token
      await user.save();
      
      // Create the reset URL
      const resetUrl = `${config.FRONTEND_URL}/reset-password/${resetToken}`;
      
      // Send the reset email
      await emailService.sendPasswordResetEmail(email, resetUrl);
      
      // Log the successful request (excluding the token for security)
      logger.info(`Password reset requested for ${email}`);
      
      return { 
        success: true, 
        message: 'If your email is registered, you will receive a password reset link shortly' 
      };
    } catch (error) {
      logger.error('Password reset request failed', { 
        error: error.message,
        email
      });
      
      throw new BusinessLogicError('Failed to process password reset request');
    }
  },
  
  /**
   * Verify the password reset token
   * @param {string} token - The password reset token
   * @returns {Promise<boolean>} Token validity
   */
  verifyResetToken: async (token) => {
    try {
      // Hash the token from the request
      const hashedToken = tokenUtil.hashToken(token);
      
      // Find user with this token that hasn't expired yet
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
      
      if (!user) {
        throw new AuthenticationError('Password reset token is invalid or has expired');
      }
      
      return { 
        success: true, 
        message: 'Token is valid',
        userId: user._id
      };
    } catch (error) {
      logger.error('Token verification failed', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Reset the password using a valid token
   * @param {string} token - The password reset token
   * @param {string} newPassword - The new password
   * @returns {Promise<Object>} Success message
   */
  resetPassword: async (token, newPassword) => {
    try {
      // First verify the token is valid
      const { userId } = await passwordService.verifyResetToken(token);
      
      // Find the user
      const user = await User.findById(userId);
      
      if (!user) {
        throw new NotFoundError('User not found');
      }
      
      // Update the password
      user.password = newPassword;
      
      // Clear the reset token and expiry
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      
      // Update the password change timestamp
      user.passwordLastChanged = Date.now();
      
      // Save the user with the new password
      await user.save();
      
      logger.info(`Password reset successful for user ID: ${userId}`);
      
      // Force logout from all devices by implementing token invalidation
      // This would typically be done by adding the user's passwordLastChanged
      // timestamp to a JWT claim and checking it on authentication
      
      return { 
        success: true, 
        message: 'Your password has been reset successfully' 
      };
    } catch (error) {
      logger.error('Password reset failed', { 
        error: error.message,
        errorType: error.constructor.name
      });
      
      throw error;
    }
  }
};

module.exports = passwordService;
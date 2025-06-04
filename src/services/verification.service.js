// src/services/verification.service.js
const User = require('../models/user.model');
const VerificationToken = require('../models/verification-token.model');
const emailService = require('./email.service');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Service for handling account verification functionality
 */
const verificationService = {
  /**
   * Generate and send a verification token to the user's email
   * @param {string} userId - User ID
   * @param {string} email - User's email address
   * @param {string} firstName - User's first name
   * @returns {Promise<Object>} Result of the operation
   */
  generateVerificationToken: async (userId, email, firstName) => {
    try {
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // If user is already verified, return success
      if (user.isVerified) {
        return { success: true, message: 'User is already verified', alreadyVerified: true };
      }
      
      // Invalidate any existing tokens
      await VerificationToken.invalidateAllUserTokens(userId, 'verification');
      
      // Generate new token
      const { plainTextToken, tokenDocument } = await VerificationToken.generateToken(
        userId, 'verification'
      );
      
      // Create verification URL
      const verificationLink = `${config.FRONTEND_URL}/verify-account?token=${plainTextToken}&userId=${userId}`;
      
      // Send verification email
      await emailService.sendVerificationEmail(
        email, 
        verificationLink, 
        firstName
      );
      
      logger.info(`Verification email sent to ${email}`, { userId });
      
      return {
        success: true,
        message: 'Verification email sent successfully',
        expiresAt: tokenDocument.expiresAt
      };
    } catch (error) {
      logger.error('Failed to generate verification token', {
        error: error.message,
        userId
      });
      throw error;
    }
  },
  
  /**
   * Verify a user's email using a verification token
   * @param {string} userId - User ID
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Result of the verification
   */
  verifyAccount: async (userId, token) => {
    try {
      // Validate the token
      const verificationResult = await VerificationToken.verifyToken(userId, token);
      
      if (!verificationResult.valid) {
        logger.warn('Invalid verification token', {
          userId,
          tokenStatus: 'Invalid or expired'
        });
        return { success: false, message: verificationResult.message };
      }
      
      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        logger.warn('User not found during verification', { userId });
        return { success: false, message: 'User not found' };
      }
      
      // If already verified, return success
      if (user.isVerified) {
        // Mark the token as used
        await verificationResult.token.markAsUsed();
        
        return { success: true, message: 'Account already verified', alreadyVerified: true };
      }
      
      // Update user as verified
      user.isVerified = true;
      await user.save();
      
      // Mark the token as used
      await verificationResult.token.markAsUsed();
      
      // Send verification success email
      await emailService.sendVerificationSuccessEmail(
        user.email,
        user.firstName,
        `${config.FRONTEND_URL}/login`
      );
      
      logger.info('User account verified successfully', { userId });
      
      return { success: true, message: 'Account verified successfully' };
    } catch (error) {
      logger.error('Account verification failed', {
        error: error.message,
        userId
      });
      throw error;
    }
  },
  
  /**
   * Resend a verification email to a user
   * @param {string} email - User's email
   * @returns {Promise<Object>} Result of the operation
   */
  resendVerificationEmail: async (email) => {
    try {
      // Find user by email
      const user = await User.findOne({ email });
      
      // Don't reveal if the email exists or not for security reasons
      if (!user) {
        logger.info(`Verification email requested for non-existent email: ${email}`);
        return {
          success: true,
          message: 'If your email is registered and not verified, you will receive a verification email'
        };
      }
      
      // If user is already verified, return success
      if (user.isVerified) {
        logger.info(`Verification email requested for already verified account: ${email}`);
        return {
          success: true, 
          message: 'Your account is already verified. You can log in.',
          alreadyVerified: true
        };
      }
      
      // Generate and send new verification token
      await verificationService.generateVerificationToken(
        user._id, 
        user.email, 
        user.firstName
      );
      
      return {
        success: true,
        message: 'If your email is registered and not verified, you will receive a verification email'
      };
    } catch (error) {
      logger.error('Failed to resend verification email', {
        error: error.message,
        email
      });
      throw error;
    }
  },
  
  /**
   * Get verification status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Verification status
   */
  getVerificationStatus: async (userId) => {
    try {
      const user = await User.findById(userId).select('isVerified email');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.isVerified) {
        return {
          isVerified: true,
          message: 'Account is verified'
        };
      }
      
      // Find the most recent active verification token
      const activeToken = await VerificationToken.findOne({
        userId,
        type: 'verification',
        isUsed: false,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });
      
      return {
        isVerified: false,
        message: 'Account is not verified',
        hasActiveToken: !!activeToken,
        tokenExpiresAt: activeToken ? activeToken.expiresAt : null
      };
    } catch (error) {
      logger.error('Failed to get verification status', {
        error: error.message,
        userId
      });
      throw error;
    }
  }
};

module.exports = verificationService;
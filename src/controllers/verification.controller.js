// src/controllers/verification.controller.js
const verificationService = require('../services/verification.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');
const auditLogger = require('../utils/audit-logger');

/**
 * Controller for handling account verification functionality
 */
const verificationController = {
  /**
   * Verify a user's account with a token
   * @route POST /api/auth/verify
   */
  verifyAccount: asyncHandler(async (req, res) => {
    const { userId, token } = req.body;
    
    logger.info('Account verification requested', { userId });
    
    const result = await verificationService.verifyAccount(userId, token);
    
    // Log verification attempt
    auditLogger.log({
      action: 'verification:attempt',
      target: userId,
      details: {
        success: result.success,
        message: result.message
      }
    });
    
    // If verification was successful, log that separately
    if (result.success && !result.alreadyVerified) {
      auditLogger.log({
        action: 'user:verified',
        target: userId,
        details: {
          timestamp: new Date()
        },
        severity: 'info'
      });
    }
    
    return ResponseUtil.success(res, result);
  }),
  
  /**
   * Resend verification email
   * @route POST /api/auth/resend-verification
   */
  resendVerification: asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    logger.info('Verification email resend requested');
    
    const result = await verificationService.resendVerificationEmail(email);
    
    // For security, we don't reveal if the email exists or not
    return ResponseUtil.success(res, {
      message: 'If your email is registered and not verified, you will receive a verification email'
    });
  }),
  
  /**
   * Get verification status for the current user
   * @route GET /api/auth/verification-status
   */
  getVerificationStatus: asyncHandler(async (req, res) => {
    // This route requires authentication
    if (!req.user || !req.user._id) {
      return ResponseUtil.error(res, 'Authentication required', 401);
    }
    
    const status = await verificationService.getVerificationStatus(req.user._id);
    
    return ResponseUtil.success(res, { status });
  }),
  
  /**
   * Send verification email during registration
   * This is meant to be called from the auth controller after user creation
   */
  sendVerificationEmail: async (userId, email, firstName) => {
    try {
      await verificationService.generateVerificationToken(userId, email, firstName);
      logger.info('Verification email sent during registration', { userId });
      return true;
    } catch (error) {
      logger.error('Failed to send verification email during registration', {
        error: error.message,
        userId
      });
      return false;
    }
  }
};

module.exports = verificationController;
// src/controllers/password.controller.js

const passwordService = require('../services/password.service');
const asyncHandler = require('../utils/async-handler.util');
const { ResponseUtil } = require('../utils/response.util');
const { AuthenticationError } = require('../utils/errors');

/**
 * Controller for handling password reset functionality
 */
const passwordController = {
  /**
   * Request a password reset link via email
   * @route POST /api/auth/forgot-password
   */
  forgotPassword: asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    const result = await passwordService.requestPasswordReset(email);
    
    return ResponseUtil.success(res, {
      message: 'If your email is registered, you will receive a password reset link shortly'
    });
  }),
  
  /**
   * Verify the password reset token
   * @route POST /api/auth/verify-reset-token
   */
  verifyResetToken: asyncHandler(async (req, res) => {
    const { token } = req.body;
    
    const result = await passwordService.verifyResetToken(token);
    
    return ResponseUtil.success(res, {
      message: 'Token is valid'
    });
  }),
  
  /**
   * Reset password with a valid token
   * @route POST /api/auth/reset-password
   */
  resetPassword: asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    
    const result = await passwordService.resetPassword(token, password);
    
    return ResponseUtil.success(res, {
      message: 'Your password has been reset successfully'
    });
  })
};

module.exports = passwordController;
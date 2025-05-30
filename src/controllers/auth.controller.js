/**
 * Healthcare Management Application
 * Authentication Controller
 * 
 * Handles HTTP requests related to authentication
 */

const authService = require('../services/auth.service');
const { 
  successResponse, 
  createdResponse, 
  errorResponse 
} = require('../utils/response.util');
const { sendTokenCookie, clearTokenCookie } = require('../utils/auth.util');
const { StatusCodes } = require('http-status-codes');
const { User, ROLES } = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Register a new user
 * @route POST /api/v1/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    // Set default role to patient if not specified (or not allowed)
    const userData = { ...req.body };
    
    // Only admins can create staff accounts
    const isStaffRole = [
      ROLES.ADMIN, 
      ROLES.DOCTOR, 
      ROLES.NURSE, 
      ROLES.RECEPTIONIST,
      ROLES.BILLING,
      ROLES.LAB_TECHNICIAN
    ].includes(userData.role);

    // If user is trying to create a staff account but is not authenticated as admin
    if (isStaffRole && (!req.user || req.user.role !== ROLES.ADMIN)) {
      userData.role = ROLES.PATIENT;
    }
    
    const { user, token, emailVerificationToken } = await authService.registerUser(userData);
    
    // In production, would send email with verification token here
    
    // Set JWT cookie
    sendTokenCookie(res, token);
    
    return createdResponse(res, {
      message: 'User registered successfully',
      data: {
        user,
        token,
        // Only include verification token in development for testing
        ...(process.env.NODE_ENV === 'development' && {
          emailVerificationToken
        })
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/v1/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const { user, token } = await authService.loginUser(email, password);
    
    // Set JWT cookie
    sendTokenCookie(res, token);
    
    return successResponse(res, {
      message: 'Login successful',
      data: { 
        user,
        token 
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/v1/auth/logout
 * @access Public
 */
const logout = (req, res) => {
  // Clear JWT cookie
  clearTokenCookie(res);
  
  return successResponse(res, {
    message: 'Logout successful'
  });
};

/**
 * Verify email
 * @route POST /api/v1/auth/verify-email
 * @access Public
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return errorResponse(res, {
        message: 'Verification token is required',
        statusCode: StatusCodes.BAD_REQUEST
      });
    }
    
    await authService.verifyEmail(token);
    
    return successResponse(res, {
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password
 * @route POST /api/v1/auth/forgot-password
 * @access Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return errorResponse(res, {
        message: 'Email is required',
        statusCode: StatusCodes.BAD_REQUEST
      });
    }
    
    const resetToken = await authService.forgotPassword(email);
    
    // In production, would send email with reset token
    
    const response = {
      message: 'Password reset token sent to email'
    };
    
    // Only include reset token in development for testing
    if (process.env.NODE_ENV === 'development') {
      response.resetToken = resetToken;
    }
    
    return successResponse(res, response);
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password
 * @route POST /api/v1/auth/reset-password
 * @access Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return errorResponse(res, {
        message: 'Token and new password are required',
        statusCode: StatusCodes.BAD_REQUEST
      });
    }
    
    await authService.resetPassword(token, newPassword);
    
    return successResponse(res, {
      message: 'Password reset successful'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password (for authenticated users)
 * @route PATCH /api/v1/auth/change-password
 * @access Protected
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return errorResponse(res, {
        message: 'Current password and new password are required',
        statusCode: StatusCodes.BAD_REQUEST
      });
    }
    
    await authService.changePassword(req.user._id, currentPassword, newPassword);
    
    return successResponse(res, {
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/v1/auth/me
 * @access Protected
 */
const getMe = async (req, res, next) => {
  try {
    // Refresh user data from database
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return errorResponse(res, {
        message: 'User not found',
        statusCode: StatusCodes.NOT_FOUND
      });
    }
    
    return successResponse(res, {
      message: 'User profile retrieved successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 * @route PATCH /api/v1/auth/me
 * @access Protected
 */
const updateMe = async (req, res, next) => {
  try {
    // Filter fields that are allowed to be updated
    const allowedFields = [
      'firstName', 
      'lastName', 
      'phoneNumber',
      'address',
      'dateOfBirth',
      'preferredLanguage',
      'emergencyContact'
    ];
    
    const filteredBody = {};
    Object.keys(req.body).forEach(field => {
      if (allowedFields.includes(field)) {
        filteredBody[field] = req.body[field];
      }
    });
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      filteredBody,
      {
        new: true,
        runValidators: true
      }
    );
    
    return successResponse(res, {
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateMe
};
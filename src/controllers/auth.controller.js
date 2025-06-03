// src/controllers/auth.controller.js

// Utility function for handling async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Import auth service
const authService = require('../services/auth.service');

// Define ValidationError class for error handling
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Cookie options for secure token storage
const getTokenCookieOptions = (rememberMe = false) => {
  const isProd = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true, // Not accessible via JavaScript
    secure: isProd, // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 7 days if remember me, else 24h
    path: '/' // Available across the site
  };
};

// Response utility functions
const successResponse = (res, options) => {
  const { message, data = null, status = 200 } = options;
  return res.status(status).json({
    success: true,
    message,
    data
  });
};

const createdResponse = (res, options) => {
  const { message, data } = options;
  return successResponse(res, { message, data, status: 201 });
};

const errorResponse = (res, options) => {
  const { message, errors = null, status = 500 } = options;
  return res.status(status).json({
    success: false,
    message,
    errors
  });
};

/**
 * Register a new user with role-specific validation
 */
exports.register = asyncHandler(async (req, res) => {
  const userData = req.body;
  
  // Register user (validation done by middleware)
  const newUser = await authService.register(userData);
  
  // Return created response with user data
  return createdResponse(res, {
    message: 'Registration successful. Please verify your email.',
    data: newUser
  });
});

/**
 * ADDED: Login user with credentials
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;
  
  // Get client information
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Authenticate user
  const { accessToken, refreshToken, user, tokenExpiry } = await authService.login(
    { email, password, rememberMe },
    ipAddress,
    userAgent
  );
  
  // Set refresh token as HTTP-only cookie (more secure than localStorage)
  res.cookie('refreshToken', refreshToken, getTokenCookieOptions(rememberMe));
  
  // Return success with tokens and user data
  return successResponse(res, {
    message: 'Login successful',
    data: {
      user,
      accessToken,
      // Don't include refresh token in response body for security
      tokenExpiry
    }
  });
});

/**
 * ADDED: Refresh access token when it expires
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or request body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  
  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }
  
  // Get client information
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  
  // Refresh the token
  const { accessToken, user } = await authService.refreshToken(
    refreshToken,
    ipAddress,
    userAgent
  );
  
  // Return success with new access token
  return successResponse(res, {
    message: 'Token refreshed successfully',
    data: {
      accessToken,
      user
    }
  });
});

/**
 * ADDED: Logout user
 */
exports.logout = asyncHandler(async (req, res) => {
  // Get refresh token from cookie or request body
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  const allDevices = req.body.allDevices || false;
  
  // Get authenticated user from request (if available)
  const user = req.user;
  
  // Logout user
  await authService.logout(refreshToken, allDevices, user);
  
  // Clear refresh token cookie
  res.clearCookie('refreshToken', { path: '/' });
  
  // Return success
  return successResponse(res, {
    message: allDevices ? 'Logged out from all devices' : 'Logged out successfully'
  });
});

/**
 * Verify a user's email address
 */
exports.verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  if (!token) {
    throw new ValidationError('Verification token is required');
  }

  const user = await authService.verifyEmail(token);
  
  return successResponse(res, {
    message: 'Email verification successful',
    data: user
  });
});

/**
 * Request password reset
 */
exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    throw new ValidationError('Email is required');
  }

  await authService.requestPasswordReset(email);
  
  // Always return success to prevent email enumeration
  return successResponse(res, {
    message: 'If your email is registered, you will receive password reset instructions'
  });
});

/**
 * Reset password with token
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  
  if (!token || !password) {
    throw new ValidationError('Token and password are required');
  }

  await authService.resetPassword(token, password);
  
  return successResponse(res, {
    message: 'Password reset successful. You can now log in with your new password.'
  });
});

/**
 * ADDED: Get current user profile
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
  // User should be available from auth middleware
  if (!req.user) {
    throw new ValidationError('No authenticated user found');
  }
  
  return successResponse(res, {
    message: 'User profile retrieved successfully',
    data: req.user
  });
});
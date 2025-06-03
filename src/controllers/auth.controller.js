// src/controllers/auth.controller.js

// CRITICAL FIX: Define asyncHandler inline to avoid dependency issues
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Define ValidationError inline to avoid dependency issues
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Simple response utility functions
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

// Simulate the auth service - replace with actual import
const authService = {
  async register(userData) {
    // This is a placeholder - replace with actual implementation
    console.log('Registering user:', userData);
    return { id: '123', ...userData, password: undefined };
  },
  
  async verifyEmail(token) {
    // This is a placeholder - replace with actual implementation
    console.log('Verifying email with token:', token);
    return { id: '123', email: 'user@example.com', emailVerified: true };
  },
  
  async requestPasswordReset(email) {
    // This is a placeholder - replace with actual implementation
    console.log('Requesting password reset for:', email);
    return true;
  },
  
  async resetPassword(token, password) {
    // This is a placeholder - replace with actual implementation
    console.log('Resetting password with token:', token);
    return true;
  }
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
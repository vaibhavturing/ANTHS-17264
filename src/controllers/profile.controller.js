// src/controllers/profile.controller.js

const profileService = require('../services/profile.service');

// Utility function for handling async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
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

const errorResponse = (res, options) => {
  const { message, errors = null, status = 500 } = options;
  return res.status(status).json({
    success: false,
    message,
    errors
  });
};

/**
 * Get the current user's profile
 */
exports.getCurrentUserProfile = asyncHandler(async (req, res) => {
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }

  const profile = await profileService.getUserProfile(
    req.user._id.toString(),
    req.user
  );
  
  return successResponse(res, {
    message: 'Profile retrieved successfully',
    data: profile
  });
});

/**
 * Get a user's profile by ID
 */
exports.getUserProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }

  const profile = await profileService.getUserProfile(userId, req.user);
  
  return successResponse(res, {
    message: 'Profile retrieved successfully',
    data: profile
  });
});

/**
 * Update the current user's profile
 */
exports.updateCurrentUserProfile = asyncHandler(async (req, res) => {
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }
  
  const updateData = req.body;
  const userId = req.user._id.toString();

  const updatedProfile = await profileService.updateProfile(
    userId,
    updateData,
    req.user
  );
  
  return successResponse(res, {
    message: 'Profile updated successfully',
    data: updatedProfile
  });
});

/**
 * Update a user's profile by ID (admin only)
 */
exports.updateUserProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const updateData = req.body;
  
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }

  const updatedProfile = await profileService.updateProfile(
    userId,
    updateData,
    req.user
  );
  
  return successResponse(res, {
    message: 'Profile updated successfully',
    data: updatedProfile
  });
});

/**
 * Upload profile picture for current user
 */
exports.uploadProfilePicture = asyncHandler(async (req, res) => {
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }
  
  // Check if file is uploaded
  if (!req.file) {
    return errorResponse(res, {
      message: 'No file uploaded',
      status: 400
    });
  }

  const userId = req.user._id.toString();
  const updatedProfile = await profileService.updateProfilePicture(
    userId,
    req.file,
    req.user
  );
  
  return successResponse(res, {
    message: 'Profile picture updated successfully',
    data: updatedProfile
  });
});

/**
 * Change current user's password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }
  
  const passwordData = {
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword
  };
  
  const userId = req.user._id.toString();
  
  await profileService.changePassword(userId, passwordData, req.user);
  
  return successResponse(res, {
    message: 'Password changed successfully'
  });
});

/**
 * Delete current user's account
 */
exports.deleteCurrentUserAccount = asyncHandler(async (req, res) => {
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }
  
  const userId = req.user._id.toString();
  
  await profileService.deleteUserAccount(userId, req.user);
  
  return successResponse(res, {
    message: 'Account deleted successfully'
  });
});

/**
 * Delete a user's account by ID (admin only)
 */
exports.deleteUserAccount = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  
  // User object is attached by auth middleware
  if (!req.user) {
    return errorResponse(res, {
      message: 'Authentication required',
      status: 401
    });
  }
  
  await profileService.deleteUserAccount(userId, req.user);
  
  return successResponse(res, {
    message: 'Account deleted successfully'
  });
});
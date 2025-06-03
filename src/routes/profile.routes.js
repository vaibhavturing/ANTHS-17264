// src/routes/profile.routes.js

const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadProfilePicture, handleMulterError } = require('../middleware/upload.middleware');
const { createProfileValidator, changePasswordSchema } = require('../validators/profile.validator');

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    if (!schema) return next();
    
    try {
      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }
      
      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};

// Dynamically select validator based on user role
const validateProfileUpdate = (req, res, next) => {
  const role = req.user ? req.user.role : 'default';
  const schema = createProfileValidator(role);
  validate(schema)(req, res, next);
};

/**
 * @route GET /api/profile
 * @desc Get current user's profile
 * @access Private
 */
router.get(
  '/',
  authenticate,
  profileController.getCurrentUserProfile
);

/**
 * @route GET /api/profile/:userId
 * @desc Get user profile by ID
 * @access Private (Admin or self only)
 */
router.get(
  '/:userId',
  authenticate,
  profileController.getUserProfile
);

/**
 * @route PUT /api/profile
 * @desc Update current user's profile
 * @access Private
 */
router.put(
  '/',
  authenticate,
  validateProfileUpdate,
  profileController.updateCurrentUserProfile
);

/**
 * @route PUT /api/profile/:userId
 * @desc Update user profile by ID (admin only)
 * @access Private (Admin)
 */
router.put(
  '/:userId',
  authenticate,
  authorize('admin'),
  validateProfileUpdate,
  profileController.updateUserProfile
);

/**
 * @route POST /api/profile/upload-picture
 * @desc Upload profile picture
 * @access Private
 */
router.post(
  '/upload-picture',
  authenticate,
  uploadProfilePicture,
  handleMulterError,
  profileController.uploadProfilePicture
);

/**
 * @route PUT /api/profile/change-password
 * @desc Change current user's password
 * @access Private
 */
router.put(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  profileController.changePassword
);

/**
 * @route DELETE /api/profile
 * @desc Delete current user's account
 * @access Private
 */
router.delete(
  '/',
  authenticate,
  profileController.deleteCurrentUserAccount
);

/**
 * @route DELETE /api/profile/:userId
 * @desc Delete user account by ID (admin only)
 * @access Private (Admin)
 */
router.delete(
  '/:userId',
  authenticate,
  authorize('admin'),
  profileController.deleteUserAccount
);

module.exports = router;
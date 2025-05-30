/**
 * Healthcare Management Application
 * Authentication Routes
 * 
 * Defines routes for user authentication and account management
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect, extractUser } = require('../middleware/auth.middleware');
const {
  registerValidator,
  loginValidator,
  emailVerificationValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  changePasswordValidator,
  updateProfileValidator
} = require('../validators/auth.validator');

const router = express.Router();

// Public routes
router.post('/register', extractUser, registerValidator, authController.register);
router.post('/login', loginValidator, authController.login);
router.post('/logout', authController.logout);
router.post('/verify-email', emailVerificationValidator, authController.verifyEmail);
router.post('/forgot-password', forgotPasswordValidator, authController.forgotPassword);
router.post('/reset-password', resetPasswordValidator, authController.resetPassword);

// Protected routes (require authentication)
router.use(protect); // All routes below this middleware require authentication

router.get('/me', authController.getMe);
router.patch('/me', updateProfileValidator, authController.updateMe);
router.patch('/change-password', changePasswordValidator, authController.changePassword);

module.exports = router;
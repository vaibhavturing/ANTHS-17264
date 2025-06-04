/**
 * User Management Routes
 * Handles user profile management, permissions, and settings
 */

const express = require('express');
const userController = require('../controllers/user.controller');
const auth = require('../middleware/auth.middleware');
const validate = require('../middleware/validate.middleware');
const userValidator = require('../validators/user.validator');
const auditLogMiddleware = require('../middleware/audit-logger.middleware');


const router = express.Router();



/**
 * @route GET /api/users
 * @desc Get a list of users (paginated, filtered)
 * @access Admin or Manager
 */
router.get(
  '/',
  auth.requireAnyRole(['admin', 'manager']), // Only admins and managers can list all users
  validate(userValidator.getUsersQuery), // Validate query parameters
  userController.getUsers
);

/**
 * @route GET /api/users/:id
 * @desc Get a single user by ID
 * @access Self or Admin
 */
router.get(
  '/:id', 
  auth.requireSelfOrRole('admin', 'id'), // Users can view their own data; admins can view any
  userController.getUserById
);

/**
 * @route POST /api/users
 * @desc Create a new user (admin only)
 * @access Admin
 */
router.post(
  '/',
  auth.requireRole('admin'),
  validate(userValidator.createUserSchema),
  userController.createUser
);

/**
 * @route PUT /api/users/:id
 * @desc Update a user's full profile
 * @access Self or Admin
 */
router.put(
  '/:id',
  auth.requireSelfOrRole('admin', 'id'),
  validate(userValidator.updateUserSchema),
  userController.updateUser
);

/**
 * @route PATCH /api/users/:id
 * @desc Partially update a user profile
 * @access Self or Admin
 */
router.patch(
  '/:id',
  auth.requireSelfOrRole('admin', 'id'),
  validate(userValidator.partialUpdateUserSchema),
  userController.partialUpdateUser
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete a user (soft delete)
 * @access Admin only
 */
router.delete(
  '/:id',
  auth.requireRole('admin'),
  userController.deleteUser
);

/**
 * @route GET /api/users/:id/permissions
 * @desc Get user permissions
 * @access Self or Admin
 */
router.get(
  '/:id/permissions',
  auth.requireRole('admin'),
  userController.getUserPermissions
);

/**
 * @route PUT /api/users/:id/permissions
 * @desc Update user permissions
 * @access Admin only
 */
router.put(
  '/:id/permissions',
  auth.requireRole('admin'),
  validate(userValidator.updatePermissionsSchema),
  userController.updateUserPermissions
);

/**
 * @route PUT /api/users/:id/change-password
 * @desc Change user password (requires old password)
 * @access Self only
 */
router.put(
  '/:id/change-password',
  auth.requireSelf('id'), // Only the user themselves can change their password
  validate(userValidator.changePasswordSchema),
  userController.changePassword
);

/**
 * @route PUT /api/users/:id/reset-password
 * @desc Force reset user password (no old password needed)
 * @access Admin only
 */
router.put(
  '/:id/reset-password',
  auth.requireRole('admin'),
  validate(userValidator.adminResetPasswordSchema),
  userController.adminResetPassword
);

module.exports = router;
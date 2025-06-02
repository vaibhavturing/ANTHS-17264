/**
 * User Controller
 * Handles all user management operations
 */

const logger = require('../utils/logger');
const asyncHandler = require('../utils/async-handler.util');
const { success } = require('../utils/response.util');
const User = require('../models/user.model');
const { NotFoundError } = require('../utils/errors/NotFoundError');

/**
 * Get all users with pagination and filtering
 */
const getUsers = asyncHandler(async (req, res) => {
  // Extract query parameters for filtering and pagination
  const { page = 1, limit = 10, role, active, search } = req.query;
  const skip = (page - 1) * limit;
  
  // Build query filters
  const query = {};
  
  if (role) {
    query.role = role;
  }
  
  if (active !== undefined) {
    query.active = active === 'true';
  }
  
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Execute query with pagination
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password -refreshToken')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments(query)
  ]);
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  
  // Return response
  return success(res, {
    users,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    }
  });
});

/**
 * Get a user by ID
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -refreshToken')
    .lean();
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  return success(res, { user });
});

/**
 * Create a new user
 */
const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, role, phoneNumber } = req.body;
  
  // Check if user with email already exists
  const existingUser = await User.findOne({ email });
  
  if (existingUser) {
    throw new Error('User with this email already exists');
  }
  
  // Create new user
  const user = new User({
    firstName,
    lastName,
    email,
    password,
    role: role || 'user',
    phoneNumber
  });
  
  await user.save();
  
  // Remove sensitive information from response
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.refreshToken;
  
  logger.info('New user created', { userId: user._id, role: user.role });
  
  return success(res, { user: userResponse }, 201);
});

/**
 * Update a user
 */
const updateUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { firstName, lastName, email, role, phoneNumber, active } = req.body;
  
  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Update user fields
  user.firstName = firstName;
  user.lastName = lastName;
  user.email = email;
  user.phoneNumber = phoneNumber;
  
  // Only admins can change role and active status
  if (req.user.role === 'admin') {
    if (role) user.role = role;
    if (active !== undefined) user.active = active;
  }
  
  await user.save();
  
  // Remove sensitive information from response
  const userResponse = user.toObject();
  delete userResponse.password;
  delete userResponse.refreshToken;
  
  logger.info('User updated', { userId });
  
  return success(res, { user: userResponse });
});

/**
 * Partially update a user
 */
const partialUpdateUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const updateData = req.body;
  
  // Remove sensitive fields that shouldn't be updated here
  delete updateData.password;
  delete updateData.refreshToken;
  
  // Only admins can update role and active status
  if (req.user.role !== 'admin') {
    delete updateData.role;
    delete updateData.active;
  }
  
  // Find and update user
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-password -refreshToken');
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  logger.info('User partially updated', { userId, fields: Object.keys(updateData) });
  
  return success(res, { user });
});

/**
 * Delete a user (soft delete)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  
  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Soft delete (deactivate) the user
  user.active = false;
  user.deactivatedAt = new Date();
  await user.save();
  
  logger.info('User deactivated (soft deleted)', { userId });
  
  return success(res, { message: 'User successfully deleted' });
});

/**
 * Get user permissions
 */
const getUserPermissions = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  
  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Get role-based permissions
  // This is a placeholder - in a real application, you would likely have a more complex permissions system
  const permissions = {
    role: user.role,
    permissions: getPermissionsForRole(user.role)
  };
  
  return success(res, { permissions });
});

/**
 * Update user permissions
 */
const updateUserPermissions = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { role } = req.body;
  
  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Update role
  user.role = role;
  await user.save();
  
  logger.info('User role updated', { userId, newRole: role });
  
  // Get new permissions
  const permissions = {
    role: user.role,
    permissions: getPermissionsForRole(user.role)
  };
  
  return success(res, { permissions });
});

/**
 * Change user password 
 */
const changePassword = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { currentPassword, newPassword } = req.body;
  
  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Verify current password
  const isPasswordValid = await user.comparePassword(currentPassword);
  
  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }
  
  // Update password
  user.password = newPassword;
  await user.save();
  
  logger.info('User password changed', { userId });
  
  return success(res, { message: 'Password successfully changed' });
});

/**
 * Admin reset user password
 */
const adminResetPassword = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const { newPassword } = req.body;
  
  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }
  
  // Update password
  user.password = newPassword;
  user.passwordResetByAdmin = true;
  user.passwordResetAt = new Date();
  await user.save();
  
  logger.info('Admin reset user password', { 
    userId, 
    adminId: req.user._id 
  });
  
  return success(res, { message: 'Password successfully reset' });
});

/**
 * Helper to get permissions for a role
 * @param {string} role - The user role
 * @returns {Array} Array of permission strings
 */
const getPermissionsForRole = (role) => {
  // This is a simple implementation - in a real app you might have a more complex permissions system
  const permissionMap = {
    admin: [
      'user:create', 'user:read', 'user:update', 'user:delete',
      'patient:create', 'patient:read', 'patient:update', 'patient:delete',
      'doctor:create', 'doctor:read', 'doctor:update', 'doctor:delete',
      'appointment:create', 'appointment:read', 'appointment:update', 'appointment:delete',
      'medical-record:create', 'medical-record:read', 'medical-record:update', 'medical-record:delete',
    ],
    doctor: [
      'patient:read',
      'appointment:create', 'appointment:read', 'appointment:update',
      'medical-record:create', 'medical-record:read', 'medical-record:update',
    ],
    nurse: [
      'patient:read',
      'appointment:read',
      'medical-record:read', 'medical-record:update',
    ],
    patient: [
      'appointment:create', 'appointment:read', 'appointment:update',
      'medical-record:read',
    ],
    user: [
      'appointment:create', 'appointment:read',
    ]
  };
  
  return permissionMap[role] || [];
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  partialUpdateUser,
  deleteUser,
  getUserPermissions,
  updateUserPermissions,
  changePassword,
  adminResetPassword
};
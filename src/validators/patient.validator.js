// src/validators/user.validator.js

/**
 * Validation schemas for user-related requests
 * Covers registration, login, profile updates, and password management
 */

const { Joi, requiredEmail, password, phone, objectId, optionalObjectId } = require('./common.validator');

// User registration validation schema
const registerSchema = {
  body: Joi.object({
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    email: requiredEmail,
    password: password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
      .messages({ 'any.only': 'Passwords must match' }),
    phone: phone.required(),
    dateOfBirth: Joi.date().less('now').required(),
    role: Joi.string().valid('patient', 'doctor', 'admin', 'receptionist', 'nurse')
      .default('patient'),
    
    // HIPAA training date - required for healthcare professionals
    hipaaTrainingDate: Joi.date().less('now')
      .when('role', {
        is: Joi.string().valid('doctor', 'admin', 'receptionist', 'nurse'),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'any.required': 'HIPAA training date is required for healthcare staff'
      }),
      
    // Additional fields for specific roles
    specialty: Joi.string()
      .when('role', {
        is: 'doctor',
        then: Joi.string().required(),
        otherwise: Joi.optional()
      }),
      
    licenseNumber: Joi.string()
      .when('role', {
        is: 'doctor',
        then: Joi.string().required(),
        otherwise: Joi.optional()
      }),
    
    // Contact and address information  
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().length(2).required(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
      country: Joi.string().default('USA')
    })
  })
};

// User login validation schema
const loginSchema = {
  body: Joi.object({
    email: requiredEmail,
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false)
  })
};

// Password reset request validation
const forgotPasswordSchema = {
  body: Joi.object({
    email: requiredEmail
  })
};

// Password reset validation
const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().required(),
    password: password,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
      .messages({ 'any.only': 'Passwords must match' })
  })
};

// Change password validation
const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password,
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords must match' })
  })
};

// Email verification validation
const verifyEmailSchema = {
  query: Joi.object({
    token: Joi.string().required()
  })
};

// Update user profile validation
const updateProfileSchema = {
  params: Joi.object({
    userId: objectId
  }),
  body: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    phone: phone.optional(),
    email: Joi.string().email().optional(),
    profileImage: Joi.string().uri().optional(),
    
    // Healthcare-specific fields
    hipaaTrainingDate: Joi.date().less('now').optional(),
    specialty: Joi.string().optional(),
    licenseNumber: Joi.string().optional(),
    department: Joi.string().optional(),
    position: Joi.string().optional(),
    
    // Contact and address information
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().length(2).required(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
      country: Joi.string().default('USA')
    }).optional(),
    
    // Notification preferences
    notificationPreferences: Joi.object({
      email: Joi.boolean().default(true),
      sms: Joi.boolean().default(true),
      push: Joi.boolean().default(true)
    }).optional(),
    
    // User cannot change their role through this endpoint
    role: Joi.forbidden().messages({
      'any.unknown': 'Role cannot be changed through this endpoint'
    })
  }).min(1).message('At least one field must be provided for update')
};

// Get user by ID validation
const getUserByIdSchema = {
  params: Joi.object({
    userId: objectId
  })
};

// Get all users with filtering validation
const getUsersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    role: Joi.string().valid('patient', 'doctor', 'admin', 'receptionist', 'nurse').optional(),
    search: Joi.string().optional(),
    sortBy: Joi.string().optional(),
    sortDirection: Joi.string().valid('asc', 'desc').optional(),
    specialty: Joi.string().optional(),
    department: Joi.string().optional(),
    status: Joi.string().valid('active', 'inactive', 'pending', 'blocked').optional()
  })
};

// User account activation/deactivation validation
const updateUserStatusSchema = {
  params: Joi.object({
    userId: objectId
  }),
  body: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'blocked').required(),
    reason: Joi.string().when('status', {
      is: 'blocked',
      then: Joi.string().required(),
      otherwise: Joi.optional()
    })
  })
};

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
  getUserByIdSchema,
  getUsersSchema,
  updateUserStatusSchema
};
// src/validators/user.validator.js
const Joi = require('joi');

/**
 * Validation schemas for user management
 * 
 * CHANGES:
 * - Defined common validators directly in this file instead of importing
 * - Added missing validators for various user fields
 * - Fixed reference to commonValidators
 * - Added proper validation messages
 */

// Define common validators directly in this file
const commonValidators = {
  // Email validator
  email: Joi.string()
    .email()
    .lowercase()
    .trim()
    .max(255)
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email address cannot be empty',
      'string.max': 'Email address cannot exceed {#limit} characters'
    }),
    
  // Password validator
  password: Joi.string()
    .min(8)
    .max(72) // bcrypt max length
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .messages({
      'string.empty': 'Password cannot be empty',
      'string.min': 'Password must be at least {#limit} characters long',
      'string.max': 'Password cannot exceed {#limit} characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    }),
    
  // Name validator
  name: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[A-Za-z\s\-']+$/)
    .messages({
      'string.empty': 'Name cannot be empty',
      'string.min': 'Name must be at least {#limit} characters long',
      'string.max': 'Name cannot exceed {#limit} characters',
      'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes'
    }),
  
  // ID validator (MongoDB ObjectId)
  id: Joi.string()
    .hex()
    .length(24)
    .messages({
      'string.empty': 'ID cannot be empty',
      'string.length': 'ID must be 24 hexadecimal characters',
      'string.hex': 'ID must contain only hexadecimal characters'
    })
};

/**
 * Validation schemas for user management
 */
const userValidator = {
  /**
   * Validation schema for creating users
   */
  createUserSchema: Joi.object({
    email: commonValidators.email.required(),
    password: commonValidators.password.required(),
    firstName: commonValidators.name.required(),
    lastName: commonValidators.name.required(),
    role: Joi.string().valid('admin', 'doctor', 'nurse', 'patient').optional(),
    roles: Joi.array().items(commonValidators.id).min(1).optional(),
    isActive: Joi.boolean().optional().default(true),
    isVerified: Joi.boolean().optional().default(false),
    phoneNumber: Joi.string().optional(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      postalCode: Joi.string().optional(),
      country: Joi.string().optional(),
    }).optional()
  }).custom((value, helpers) => {
    // Either role or roles should be provided
    if (!value.role && (!value.roles || value.roles.length === 0)) {
      return helpers.error('object.missing', {
        peers: ['role', 'roles'],
        message: 'Either role or roles must be provided'
      });
    }
    return value;
  }),

  /**
   * Validation schema for updating users
   */
  updateUserSchema: Joi.object({
    email: commonValidators.email.optional(),
    password: commonValidators.password.optional(),
    firstName: commonValidators.name.optional(),
    lastName: commonValidators.name.optional(),
    role: Joi.string().valid('admin', 'doctor', 'nurse', 'patient').optional(),
    roles: Joi.array().items(commonValidators.id).min(1).optional(),
    isActive: Joi.boolean().optional(),
    isVerified: Joi.boolean().optional(), 
    phoneNumber: Joi.string().optional(),
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      postalCode: Joi.string().optional(),
      country: Joi.string().optional(),
    }).optional()
  }).min(1),

  /**
   * Validation schema for role assignment
   */
  updateRolesSchema: Joi.object({
    roles: Joi.array().items(commonValidators.id).min(1).required()
  }),

  /**
   * Validation schema for bulk operations
   */
  bulkOperationSchema: Joi.object({
    operation: Joi.string().valid('activate', 'deactivate', 'delete', 'assignRole').required(),
    userIds: Joi.array().items(commonValidators.id).min(1).required(),
    options: Joi.object({
      roleId: Joi.string().hex().length(24).when('..operation', {
        is: 'assignRole',
        then: Joi.required(),
        otherwise: Joi.forbidden()
      })
    }).optional()
  }),

  /**
   * Validation schema for advanced user search
   */
  searchUsersSchema: Joi.object({
    search: Joi.string().optional(),
    roles: Joi.alternatives().try(
      commonValidators.id,
      Joi.array().items(commonValidators.id)
    ).optional(),
    isActive: Joi.boolean().optional(),
    isVerified: Joi.boolean().optional(),
    createdAfter: Joi.date().iso().optional(),
    createdBefore: Joi.date().iso().optional(),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').optional(),
    limit: Joi.number().integer().min(1).max(1000).optional()
  })
};

module.exports = userValidator;
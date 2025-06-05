// File: src/validators/auth.validator.js
// Complete validation schemas for auth routes

const Joi = require('joi');

/**
 * Validation schemas for authentication routes
 */
const authValidator = {
  /**
   * Schema for user registration
   */
  register: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least {#limit} characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'Password is required'
      }),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'string.empty': 'Confirm password is required',
      'any.only': 'Passwords must match',
      'any.required': 'Confirm password is required'
    }),
    firstName: Joi.string().required().messages({
      'string.empty': 'First name is required',
      'any.required': 'First name is required'
    }),
    lastName: Joi.string().required().messages({
      'string.empty': 'Last name is required',
      'any.required': 'Last name is required'
    }),
    role: Joi.string().valid('admin', 'doctor', 'nurse', 'patient').default('patient').messages({
      'any.only': 'Role must be one of: admin, doctor, nurse, patient'
    })
  }),

  /**
   * Schema for user login
   */
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
  }),

  /**
   * Schema for refresh token
   */
  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required'
    })
  }),

  /**
   * Schema for verify email
   */
  verifyEmail: Joi.object({
    token: Joi.string().required().messages({
      'string.empty': 'Verification token is required',
      'any.required': 'Verification token is required'
    })
  }),

  /**
   * Schema for resend verification email
   */
  resendVerification: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    })
  }),

  /**
   * Schema for password change
   */
  changePassword: Joi.object({
    currentPassword: Joi.string().required().messages({
      'string.empty': 'Current password is required',
      'any.required': 'Current password is required'
    }),
    newPassword: Joi.string().min(8).required()
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .messages({
        'string.empty': 'New password is required',
        'string.min': 'New password must be at least {#limit} characters long',
        'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required'
      }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'string.empty': 'Confirm password is required',
      'any.only': 'Passwords must match',
      'any.required': 'Confirm password is required'
    })
  })
};

module.exports = authValidator;
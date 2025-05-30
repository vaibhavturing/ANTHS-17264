/**
 * Healthcare Management Application
 * Authentication Validators
 * 
 * Validation schemas for authentication-related requests
 */

const Joi = require('joi');
const { BadRequestError } = require('../utils/api-error.util');

/**
 * Validate request middleware creator
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {String} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true
      });
      
      if (error) {
        const errorDetails = error.details.reduce((acc, detail) => {
          acc[detail.context.key] = detail.message;
          return acc;
        }, {});
        
        throw new BadRequestError('Validation failed', errorDetails);
      }
      
      req[source] = value;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Registration validation schema
const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required()
    .messages({
      'string.base': 'First name must be a string',
      'string.empty': 'First name is required',
      'string.min': 'First name must be at least {#limit} characters',
      'string.max': 'First name cannot exceed {#limit} characters',
      'any.required': 'First name is required'
    }),
  lastName: Joi.string().trim().min(2).max(50).required()
    .messages({
      'string.base': 'Last name must be a string',
      'string.empty': 'Last name is required',
      'string.min': 'Last name must be at least {#limit} characters',
      'string.max': 'Last name cannot exceed {#limit} characters',
      'any.required': 'Last name is required'
    }),
  email: Joi.string().email().required()
    .messages({
      'string.base': 'Email must be a string',
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
  password: Joi.string().min(8).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .messages({
      'string.base': 'Password must be a string',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least {#limit} characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'Password is required'
    }),
  passwordConfirm: Joi.string().valid(Joi.ref('password')).required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your password'
    }),
  phoneNumber: Joi.string().pattern(new RegExp('^\\+?[1-9]\\d{9,14}$')).allow(null, '')
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  dateOfBirth: Joi.date().max('now').allow(null)
    .messages({
      'date.base': 'Please provide a valid date',
      'date.max': 'Date of birth must be in the past'
    }),
  role: Joi.string().valid('patient', 'doctor', 'nurse', 'admin', 'receptionist', 'billing', 'lab_technician')
    .default('patient')
    .messages({
      'any.only': 'Invalid role'
    }),
  address: Joi.object({
    street: Joi.string().allow(null, ''),
    city: Joi.string().allow(null, ''),
    state: Joi.string().allow(null, ''),
    zipCode: Joi.string().allow(null, ''),
    country: Joi.string().allow(null, '')
  }).allow(null),
  termsAccepted: Joi.boolean().valid(true).required()
    .messages({
      'any.only': 'You must accept terms and conditions',
      'any.required': 'Terms acceptance is required'
    }),
  privacyPolicyAccepted: Joi.boolean().valid(true).required()
    .messages({
      'any.only': 'You must accept the privacy policy',
      'any.required': 'Privacy policy acceptance is required'  
    })
});

// Login validation schema
const loginSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    }),
  password: Joi.string().required()
    .messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required'
    })
});

// Email verification schema
const emailVerificationSchema = Joi.object({
  token: Joi.string().required()
    .messages({
      'string.empty': 'Verification token is required',
      'any.required': 'Verification token is required'
    })
});

// Forgot password schema
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.empty': 'Email is required',
      'any.required': 'Email is required'
    })
});

// Reset password schema
const resetPasswordSchema = Joi.object({
  token: Joi.string().required()
    .messages({
      'string.empty': 'Reset token is required', 
      'any.required': 'Reset token is required'
    }),
  newPassword: Joi.string().min(8).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .messages({
      'string.base': 'Password must be a string',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least {#limit} characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'New password is required'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your password'
    })
});

// Change password schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required()
    .messages({
      'string.empty': 'Current password is required',
      'any.required': 'Current password is required'  
    }),
  newPassword: Joi.string().min(8).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .messages({
      'string.base': 'Password must be a string',
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least {#limit} characters',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'New password is required'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Please confirm your password'
    })
});

// Update profile schema
const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50)
    .messages({
      'string.base': 'First name must be a string',
      'string.min': 'First name must be at least {#limit} characters',
      'string.max': 'First name cannot exceed {#limit} characters'
    }),
  lastName: Joi.string().trim().min(2).max(50)
    .messages({
      'string.base': 'Last name must be a string',
      'string.min': 'Last name must be at least {#limit} characters',
      'string.max': 'Last name cannot exceed {#limit} characters'
    }),
  phoneNumber: Joi.string().pattern(new RegExp('^\\+?[1-9]\\d{9,14}$')).allow(null, '')
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  dateOfBirth: Joi.date().max('now').allow(null)
    .messages({
      'date.base': 'Please provide a valid date',
      'date.max': 'Date of birth must be in the past'
    }),
  address: Joi.object({
    street: Joi.string().allow(null, ''),
    city: Joi.string().allow(null, ''),
    state: Joi.string().allow(null, ''),
    zipCode: Joi.string().allow(null, ''),
    country: Joi.string().allow(null, '')
  }).allow(null),
  preferredLanguage: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja', 'other')
    .default('en')
    .messages({
      'any.only': 'Invalid language selection'
    }),
  emergencyContact: Joi.object({
    name: Joi.string().allow(null, ''),
    relationship: Joi.string().allow(null, ''),
    phoneNumber: Joi.string().pattern(new RegExp('^\\+?[1-9]\\d{9,14}$')).allow(null, '')
      .messages({
        'string.pattern.base': 'Please provide a valid phone number for emergency contact'
      })
  }).allow(null)
});

module.exports = {
  validate,
  registerValidator: validate(registerSchema),
  loginValidator: validate(loginSchema),
  emailVerificationValidator: validate(emailVerificationSchema),
  forgotPasswordValidator: validate(forgotPasswordSchema),
  resetPasswordValidator: validate(resetPasswordSchema),
  changePasswordValidator: validate(changePasswordSchema),
  updateProfileValidator: validate(updateProfileSchema)
};
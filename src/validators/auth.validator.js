// src/validators/auth.validator.js

const Joi = require('joi');

// Define regex patterns directly as RegExp objects
const emailRegex = new RegExp('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
const passwordRegex = new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$');
const nameRegex = new RegExp('^[A-Za-z\\s\'-]{1,50}$');
const phoneRegex = new RegExp('^\\+?[1-9]\\d{1,14}$');

// EXISTING CODE: Registration validation schema
const registerSchema = Joi.object({
  email: Joi.string().required().pattern(emailRegex).trim().lowercase()
    .messages({
      'string.pattern.base': 'Email must be in a valid format',
      'string.empty': 'Email cannot be empty',
      'any.required': 'Email is required'
    }),
  password: Joi.string().min(8).required().pattern(passwordRegex)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.min': 'Password must be at least 8 characters long',
      'string.empty': 'Password cannot be empty',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string().required().pattern(nameRegex).trim()
    .messages({
      'string.pattern.base': 'First name must contain only letters, spaces, hyphens, and apostrophes',
      'string.empty': 'First name cannot be empty',
      'any.required': 'First name is required'
    }),
  lastName: Joi.string().required().pattern(nameRegex).trim()
    .messages({
      'string.pattern.base': 'Last name must contain only letters, spaces, hyphens, and apostrophes',
      'string.empty': 'Last name cannot be empty',
      'any.required': 'Last name is required'
    }),
  role: Joi.string().required().valid('patient', 'doctor', 'nurse', 'admin')
    .messages({
      'any.only': 'Role must be one of: patient, doctor, nurse, admin',
      'string.empty': 'Role cannot be empty',
      'any.required': 'Role is required'
    }),
  // Rest of the existing registration schema...
  // [skipping the rest for brevity]
}).options({ abortEarly: false });

// UPDATED: Enhanced login schema with remember me option
const loginSchema = Joi.object({
  email: Joi.string().required().pattern(emailRegex).trim().lowercase()
    .messages({
      'string.pattern.base': 'Email must be in a valid format',
      'string.empty': 'Email cannot be empty',
      'any.required': 'Email is required'
    }),
  password: Joi.string().required()
    .messages({
      'string.empty': 'Password cannot be empty',
      'any.required': 'Password is required'
    }),
  // ADDED: Remember me option for extended session
  rememberMe: Joi.boolean().default(false)
}).options({ abortEarly: false });

// ADDED: Refresh token schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
    .messages({
      'string.empty': 'Refresh token cannot be empty',
      'any.required': 'Refresh token is required'
    })
}).options({ abortEarly: false });

// EXISTING CODE: Password reset request schema
const passwordResetRequestSchema = Joi.object({
  email: Joi.string().required().pattern(emailRegex).trim().lowercase()
    .messages({
      'string.pattern.base': 'Email must be in a valid format',
      'string.empty': 'Email cannot be empty',
      'any.required': 'Email is required'
    })
}).options({ abortEarly: false });

// EXISTING CODE: Password reset schema
const passwordResetSchema = Joi.object({
  token: Joi.string().required()
    .messages({
      'string.empty': 'Token cannot be empty',
      'any.required': 'Token is required'
    }),
  password: Joi.string().min(8).required().pattern(passwordRegex)
    .messages({
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.min': 'Password must be at least 8 characters long',
      'string.empty': 'Password cannot be empty',
      'any.required': 'Password is required'
    })
}).options({ abortEarly: false });

// ADDED: Logout schema
const logoutSchema = Joi.object({
  refreshToken: Joi.string()
    .messages({
      'string.empty': 'Refresh token cannot be empty'
    }),
  allDevices: Joi.boolean().default(false)
}).options({ abortEarly: false });

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  logoutSchema
};
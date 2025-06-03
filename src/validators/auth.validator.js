// src/validators/auth.validator.js

const Joi = require('joi');

// CRITICAL FIX: Define regex patterns directly as RegExp objects, not importing from another file
// This avoids dependency issues and ensures the patterns are properly formatted
const emailRegex = new RegExp('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
const passwordRegex = new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$');
const nameRegex = new RegExp('^[A-Za-z\\s\'-]{1,50}$');
const phoneRegex = new RegExp('^\\+?[1-9]\\d{1,14}$');

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
  phoneNumber: Joi.string().pattern(phoneRegex).trim()
    .messages({
      'string.pattern.base': 'Phone number must be in a valid format (e.g., +1-123-456-7890)'
    }),
  dateOfBirth: Joi.date().max('now').iso()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'date.format': 'Date of birth must be in ISO format (YYYY-MM-DD)'
    }),
  
  // Role-specific fields - conditionally required based on role
  // Patient-specific fields
  insuranceProvider: Joi.when('role', {
    is: 'patient',
    then: Joi.string().trim().required()
      .messages({
        'string.empty': 'Insurance provider cannot be empty',
        'any.required': 'Insurance provider is required for patients'
      }),
    otherwise: Joi.string().trim().allow('', null)
  }),
  insuranceId: Joi.when('role', {
    is: 'patient',
    then: Joi.string().trim().required()
      .messages({
        'string.empty': 'Insurance ID cannot be empty',
        'any.required': 'Insurance ID is required for patients'
      }),
    otherwise: Joi.string().trim().allow('', null)
  }),
  emergencyContact: Joi.when('role', {
    is: 'patient',
    then: Joi.object({
      name: Joi.string().required().pattern(nameRegex).trim(),
      relationship: Joi.string().required().trim(),
      phoneNumber: Joi.string().required().pattern(phoneRegex).trim()
    }).required()
      .messages({
        'any.required': 'Emergency contact information is required for patients'
      }),
    otherwise: Joi.object().allow(null)
  }),
  
  // Doctor-specific fields
  licenseNumber: Joi.when('role', {
    is: 'doctor',
    then: Joi.string().required().trim()
      .messages({
        'string.empty': 'License number cannot be empty',
        'any.required': 'License number is required for doctors'
      }),
    otherwise: Joi.string().trim().allow('', null)
  }),
  specialties: Joi.when('role', {
    is: 'doctor',
    then: Joi.array().items(Joi.string().trim()).min(1).required()
      .messages({
        'array.min': 'At least one specialty is required',
        'any.required': 'Specialties are required for doctors'
      }),
    otherwise: Joi.array().items(Joi.string().trim()).allow(null)
  }),
  yearsOfExperience: Joi.when('role', {
    is: 'doctor',
    then: Joi.number().integer().min(0).required()
      .messages({
        'number.base': 'Years of experience must be a number',
        'number.min': 'Years of experience cannot be negative',
        'any.required': 'Years of experience is required for doctors'
      }),
    otherwise: Joi.number().allow(null)
  }),
  
  // Nurse-specific fields
  nursingLicense: Joi.when('role', {
    is: 'nurse',
    then: Joi.string().required().trim()
      .messages({
        'string.empty': 'Nursing license cannot be empty',
        'any.required': 'Nursing license is required for nurses'
      }),
    otherwise: Joi.string().trim().allow('', null)
  }),
  department: Joi.when('role', {
    is: Joi.alternatives().try('nurse', 'doctor'),
    then: Joi.string().required().trim()
      .messages({
        'string.empty': 'Department cannot be empty',
        'any.required': 'Department is required for healthcare professionals'
      }),
    otherwise: Joi.string().trim().allow('', null)
  }),
  
  // Admin-specific fields
  adminType: Joi.when('role', {
    is: 'admin',
    then: Joi.string().valid('system', 'billing', 'front-desk', 'medical-records').required()
      .messages({
        'any.only': 'Admin type must be one of: system, billing, front-desk, medical-records',
        'any.required': 'Admin type is required for administrators'
      }),
    otherwise: Joi.string().allow('', null)
  }),
  securityClearance: Joi.when('role', {
    is: 'admin',
    then: Joi.string().valid('level1', 'level2', 'level3').required()
      .messages({
        'any.only': 'Security clearance must be one of: level1, level2, level3',
        'any.required': 'Security clearance is required for administrators'
      }),
    otherwise: Joi.string().allow('', null)
  })
}).options({ abortEarly: false });

// Login validation schema
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
    })
}).options({ abortEarly: false });

// Password reset request schema
const passwordResetRequestSchema = Joi.object({
  email: Joi.string().required().pattern(emailRegex).trim().lowercase()
    .messages({
      'string.pattern.base': 'Email must be in a valid format',
      'string.empty': 'Email cannot be empty',
      'any.required': 'Email is required'
    })
}).options({ abortEarly: false });

// Password reset schema
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

module.exports = {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema
};
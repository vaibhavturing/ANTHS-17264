// src/validators/profile.validator.js

const Joi = require('joi');

// Define regex patterns directly as RegExp objects
const nameRegex = new RegExp('^[A-Za-z\\s\'-]{1,50}$');
const phoneRegex = new RegExp('^\\+?[1-9]\\d{1,14}$');
const emailRegex = new RegExp('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');

// Base profile fields that all roles can update
const baseProfileSchema = {
  firstName: Joi.string().pattern(nameRegex).trim()
    .messages({
      'string.pattern.base': 'First name must contain only letters, spaces, hyphens, and apostrophes',
      'string.empty': 'First name cannot be empty'
    }),
  lastName: Joi.string().pattern(nameRegex).trim()
    .messages({
      'string.pattern.base': 'Last name must contain only letters, spaces, hyphens, and apostrophes',
      'string.empty': 'Last name cannot be empty'
    }),
  phoneNumber: Joi.string().pattern(phoneRegex).trim()
    .messages({
      'string.pattern.base': 'Phone number must be in a valid format (e.g., +1-123-456-7890)'
    }),
  dateOfBirth: Joi.date().max('now').iso()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'date.format': 'Date of birth must be in ISO format (YYYY-MM-DD)'
    })
};

// Patient-specific profile fields
const patientProfileSchema = {
  ...baseProfileSchema,
  insuranceProvider: Joi.string().trim()
    .messages({
      'string.empty': 'Insurance provider cannot be empty'
    }),
  insuranceId: Joi.string().trim()
    .messages({
      'string.empty': 'Insurance ID cannot be empty'
    }),
  emergencyContact: Joi.object({
    name: Joi.string().pattern(nameRegex).trim().required()
      .messages({
        'string.pattern.base': 'Emergency contact name must contain only letters, spaces, hyphens, and apostrophes',
        'string.empty': 'Emergency contact name cannot be empty',
        'any.required': 'Emergency contact name is required'
      }),
    relationship: Joi.string().trim().required()
      .messages({
        'string.empty': 'Relationship cannot be empty',
        'any.required': 'Relationship is required'
      }),
    phoneNumber: Joi.string().pattern(phoneRegex).trim().required()
      .messages({
        'string.pattern.base': 'Emergency contact phone number must be in a valid format',
        'string.empty': 'Emergency contact phone number cannot be empty',
        'any.required': 'Emergency contact phone number is required'
      })
  })
};

// Doctor-specific profile fields
const doctorProfileSchema = {
  ...baseProfileSchema,
  licenseNumber: Joi.string().trim()
    .messages({
      'string.empty': 'License number cannot be empty'
    }),
  specialties: Joi.array().items(Joi.string().trim()).min(1)
    .messages({
      'array.min': 'At least one specialty is required'
    }),
  yearsOfExperience: Joi.number().integer().min(0)
    .messages({
      'number.base': 'Years of experience must be a number',
      'number.min': 'Years of experience cannot be negative'
    }),
  department: Joi.string().trim()
    .messages({
      'string.empty': 'Department cannot be empty'
    }),
  education: Joi.array().items(Joi.object({
    degree: Joi.string().required(),
    institution: Joi.string().required(),
    year: Joi.number().integer().min(1950).max(new Date().getFullYear()).required()
  })),
  availability: Joi.array().items(Joi.object({
    dayOfWeek: Joi.number().integer().min(0).max(6).required(),
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required()
  })),
  bio: Joi.string().max(1000)
};

// Nurse-specific profile fields
const nurseProfileSchema = {
  ...baseProfileSchema,
  nursingLicense: Joi.string().trim()
    .messages({
      'string.empty': 'Nursing license cannot be empty'
    }),
  department: Joi.string().trim()
    .messages({
      'string.empty': 'Department cannot be empty'
    }),
  certifications: Joi.array().items(Joi.string().trim()),
  education: Joi.array().items(Joi.object({
    degree: Joi.string().required(),
    institution: Joi.string().required(),
    year: Joi.number().integer().min(1950).max(new Date().getFullYear()).required()
  }))
};

// Admin-specific profile fields
const adminProfileSchema = {
  ...baseProfileSchema,
  department: Joi.string().trim()
    .messages({
      'string.empty': 'Department cannot be empty'
    }),
  jobTitle: Joi.string().trim()
    .messages({
      'string.empty': 'Job title cannot be empty'
    })
};

// Change password schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required()
    .messages({
      'string.empty': 'Current password cannot be empty',
      'any.required': 'Current password is required'
    }),
  newPassword: Joi.string().min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'))
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'string.empty': 'New password cannot be empty',
      'any.required': 'New password is required'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({
      'any.only': 'Passwords do not match',
      'string.empty': 'Confirm password cannot be empty',
      'any.required': 'Confirm password is required'
    })
}).options({ abortEarly: false });

// Create role-based profile update validators
const createProfileValidator = (role) => {
  let schema;
  
  switch (role) {
    case 'patient':
      schema = Joi.object(patientProfileSchema);
      break;
    case 'doctor':
      schema = Joi.object(doctorProfileSchema);
      break;
    case 'nurse':
      schema = Joi.object(nurseProfileSchema);
      break;
    case 'admin':
      schema = Joi.object(adminProfileSchema);
      break;
    default:
      schema = Joi.object(baseProfileSchema);
  }
  
  return schema.options({ abortEarly: false });
};

module.exports = {
  createProfileValidator,
  changePasswordSchema,
  // For direct access to role-specific schemas
  baseProfileSchema: Joi.object(baseProfileSchema),
  patientProfileSchema: Joi.object(patientProfileSchema),
  doctorProfileSchema: Joi.object(doctorProfileSchema),
  nurseProfileSchema: Joi.object(nurseProfileSchema),
  adminProfileSchema: Joi.object(adminProfileSchema)
};
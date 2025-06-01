// src/validators/common.validator.js

/**
 * Common validation schemas for reuse across the application
 * Provides standard patterns for commonly used data types 
 * specific to healthcare applications
 */

const Joi = require('joi');
const { Types } = require('mongoose');

/**
 * Custom Joi extension for MongoDB ObjectId validation
 */
const JoiObjectId = Joi.extend((joi) => {
  return {
    type: 'objectId',
    base: joi.string(),
    messages: {
      'objectId.invalid': '{{#label}} must be a valid MongoDB ObjectId'
    },
    validate(value, helpers) {
      if (!Types.ObjectId.isValid(value)) {
        return { value, errors: helpers.error('objectId.invalid') };
      }
      return { value };
    }
  };
});

// Common schema patterns for reuse
const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: JoiObjectId.objectId().required(),
  optionalObjectId: JoiObjectId.objectId(),
  
  // Basic types with common restrictions
  requiredString: Joi.string().trim().required(),
  optionalString: Joi.string().trim().allow(''),
  requiredEmail: Joi.string().email().trim().lowercase().required(),
  optionalEmail: Joi.string().email().trim().lowercase().allow(''),
  password: Joi.string().min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must be at least 8 characters and include uppercase, lowercase, numbers, and special characters')
    .required(),
  phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).message('Phone number must be valid and include country code if applicable'),
  
  // Healthcare-specific schemas
  // U.S. Social Security Number
  ssn: Joi.string()
    .pattern(/^\d{3}-?\d{2}-?\d{4}$/)
    .message('SSN must be in the format XXX-XX-XXXX or XXXXXXXXX')
    .when('$isUpdate', { is: true, then: Joi.optional(), otherwise: Joi.required() }),
  
  // National Provider Identifier (NPI) for healthcare providers
  npi: Joi.string()
    .pattern(/^\d{10}$/)
    .message('NPI must be a 10-digit number'),
  
  // International Classification of Diseases (ICD-10) code
  icd10Code: Joi.string()
    .pattern(/^[A-Z][0-9][0-9AB]\.?[0-9A-Z]{0,4}$/)
    .message('Must be a valid ICD-10 code format'),
  
  // Current Procedural Terminology (CPT) code
  cptCode: Joi.string()
    .pattern(/^\d{5}$/)
    .message('Must be a valid 5-digit CPT code'),
  
  // Healthcare Common Procedure Coding System (HCPCS) code
  hcpcsCode: Joi.string()
    .pattern(/^[A-Z]\d{4}$/)
    .message('Must be a valid HCPCS code (letter followed by 4 digits)'),
  
  // National Drug Code (NDC)
  ndcCode: Joi.string()
    .pattern(/^\d{4,5}-\d{3,4}-\d{1,2}$/)
    .message('Must be a valid NDC code format (XXXX-XXX-XX or XXXXX-XXXX-XX)'),
  
  // Dates and times
  pastDate: Joi.date().less('now').message('Date must be in the past'),
  futureDate: Joi.date().greater('now').message('Date must be in the future'),
  dateOfBirth: Joi.date().less('now').message('Date of birth must be in the past'),
  
  // Valid blood types
  bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'),
  
  // Gender options (including non-binary and options for transgender patients)
  gender: Joi.string().valid(
    'male', 'female', 'non-binary', 'transgender-male', 'transgender-female', 
    'other', 'prefer-not-to-say'
  ),
  
  // Medical license number
  medicalLicense: Joi.string().pattern(/^[A-Z0-9]{5,15}$/).message('Medical license number must be 5-15 alphanumeric characters'),
  
  // Medical specialty
  medicalSpecialty: Joi.string().valid(
    'cardiology', 'dermatology', 'endocrinology', 'gastroenterology', 'hematology',
    'infectious-disease', 'internal-medicine', 'nephrology', 'neurology', 'obstetrics',
    'gynecology', 'oncology', 'ophthalmology', 'orthopedics', 'otolaryngology', 
    'pediatrics', 'psychiatry', 'pulmonology', 'radiology', 'rheumatology', 
    'surgery', 'urology', 'family-medicine', 'emergency-medicine', 'other'
  ),
  
  // Insurance-related
  insuranceProvider: Joi.string().max(100),
  insurancePolicyNumber: Joi.string().max(50),
  insuranceGroupNumber: Joi.string().max(50),
  
  // Status fields
  appointmentStatus: Joi.string().valid(
    'scheduled', 'confirmed', 'checked-in', 'in-progress', 
    'completed', 'cancelled', 'no-show', 'rescheduled'
  ),
  
  patientStatus: Joi.string().valid(
    'active', 'inactive', 'pending', 'archived'
  ),
  
  // Allergy information
  allergyType: Joi.string().valid(
    'medication', 'food', 'environmental', 'other'
  ),
  
  allergySeverity: Joi.string().valid(
    'mild', 'moderate', 'severe', 'life-threatening'
  ),
  
  // Common schema objects
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).message('ZIP code must be valid (XXXXX or XXXXX-XXXX format)').required(),
    country: Joi.string().default('USA')
  }),
  
  // Contact information
  contactInfo: Joi.object({
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
    alternatePhone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).optional(),
    preferredContactMethod: Joi.string().valid('email', 'phone', 'sms').default('phone')
  }),
  
  // Emergency contact
  emergencyContact: Joi.object({
    name: Joi.string().required(),
    relationship: Joi.string().required(),
    phone: Joi.string().pattern(/^\+?[0-9]{10,15}$/).required(),
    email: Joi.string().email().optional(),
    address: Joi.string().optional()
  }),
  
  // Pagination parameters
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string()
  })
};

module.exports = {
  ...commonSchemas,
  Joi,
  JoiObjectId
};
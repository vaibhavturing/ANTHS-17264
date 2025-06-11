const Joi = require('joi');

// Validators for insurance-related operations
const insuranceValidators = {
  // Validate insurance provider
  validateInsuranceProvider: Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.base': 'Insurance provider name must be a string',
        'string.empty': 'Insurance provider name is required',
        'string.min': 'Insurance provider name must be at least {#limit} characters',
        'string.max': 'Insurance provider name cannot exceed {#limit} characters',
        'any.required': 'Insurance provider name is required'
      }),
    contactPhone: Joi.string().trim().pattern(/^[0-9+\-() ]{10,20}$/).required()
      .messages({
        'string.pattern.base': 'Contact phone must be a valid phone number',
        'any.required': 'Contact phone is required'
      }),
    contactEmail: Joi.string().trim().email().required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'any.required': 'Contact email is required'
      }),
    address: Joi.object({
      street: Joi.string().trim().required(),
      city: Joi.string().trim().required(),
      state: Joi.string().trim().required(),
      zipCode: Joi.string().trim().required(),
      country: Joi.string().trim().required()
    }).required()
      .messages({
        'any.required': 'Address is required'
      }),
    verificationEndpoint: Joi.string().trim().uri().allow('').optional(),
    claimsEndpoint: Joi.string().trim().uri().allow('').optional(),
    isActive: Joi.boolean().default(true)
  }),

  // Validate insurance plan
  validateInsurancePlan: Joi.object({
    planName: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.base': 'Plan name must be a string',
        'string.empty': 'Plan name is required',
        'any.required': 'Plan name is required'
      }),
    providerId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Provider ID must be a valid MongoDB ObjectId',
        'any.required': 'Provider ID is required'
      }),
    coverageDetails: Joi.object().required()
      .messages({
        'any.required': 'Coverage details are required'
      }),
    planType: Joi.string().valid('HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'Other').required()
      .messages({
        'any.only': 'Plan type must be one of: HMO, PPO, EPO, POS, HDHP, Other',
        'any.required': 'Plan type is required'
      }),
    deductible: Joi.number().min(0).required()
      .messages({
        'number.base': 'Deductible must be a number',
        'number.min': 'Deductible cannot be negative',
        'any.required': 'Deductible is required'
      }),
    coPayAmount: Joi.number().min(0).required()
      .messages({
        'number.base': 'Co-pay amount must be a number',
        'number.min': 'Co-pay amount cannot be negative',
        'any.required': 'Co-pay amount is required'
      }),
    coveragePercentage: Joi.number().min(0).max(100).required()
      .messages({
        'number.base': 'Coverage percentage must be a number',
        'number.min': 'Coverage percentage cannot be negative',
        'number.max': 'Coverage percentage cannot exceed 100',
        'any.required': 'Coverage percentage is required'
      }),
    outOfPocketMax: Joi.number().min(0).required()
      .messages({
        'number.base': 'Out-of-pocket maximum must be a number',
        'number.min': 'Out-of-pocket maximum cannot be negative',
        'any.required': 'Out-of-pocket maximum is required'
      }),
    isActive: Joi.boolean().default(true)
  }),

  // Validate patient insurance
  validatePatientInsurance: Joi.object({
    patientId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Patient ID must be a valid MongoDB ObjectId',
        'any.required': 'Patient ID is required'
      }),
    providerId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Provider ID must be a valid MongoDB ObjectId',
        'any.required': 'Provider ID is required'
      }),
    planId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).allow(null).optional(),
    memberNumber: Joi.string().trim().required()
      .messages({
        'string.base': 'Member number must be a string',
        'string.empty': 'Member number is required',
        'any.required': 'Member number is required'
      }),
    groupNumber: Joi.string().trim().allow('').optional(),
    policyHolder: Joi.object({
      name: Joi.string().trim().required(),
      relationship: Joi.string().valid('self', 'spouse', 'child', 'other').default('self'),
      dateOfBirth: Joi.date().iso().less('now').optional()
    }).optional(),
    effectiveDate: Joi.date().iso().required()
      .messages({
        'date.base': 'Effective date must be a valid date',
        'any.required': 'Effective date is required'
      }),
    expirationDate: Joi.date().iso().greater(Joi.ref('effectiveDate')).allow(null).optional()
      .messages({
        'date.greater': 'Expiration date must be after the effective date'
      }),
    isPrimary: Joi.boolean().default(true),
    isActive: Joi.boolean().default(true),
    coverageDetails: Joi.object().allow(null).optional()
  }),

  // Validate insurance verification request
  validateInsuranceVerification: Joi.object({
    patientInsuranceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Patient insurance ID must be a valid MongoDB ObjectId',
        'any.required': 'Patient insurance ID is required'
      })
  })
};

module.exports = insuranceValidators;
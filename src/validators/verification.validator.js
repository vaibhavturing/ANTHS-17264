// src/validators/verification.validator.js
const Joi = require('joi');

/**
 * Validation schemas for account verification functionality
 */
const verificationValidator = {
  /**
   * Validation schema for verifying an account
   */
  verifyAccountSchema: Joi.object({
    userId: Joi.string()
      .hex()
      .length(24)
      .required()
      .messages({
        'string.base': 'User ID must be a string',
        'string.empty': 'User ID is required',
        'string.length': 'User ID must be 24 characters long',
        'string.hex': 'User ID must only contain hexadecimal characters',
        'any.required': 'User ID is required'
      }),
    token: Joi.string()
      .required()
      .messages({
        'string.base': 'Token must be a string',
        'string.empty': 'Token is required',
        'any.required': 'Token is required'
      })
  }),
  
  /**
   * Validation schema for resending verification email
   */
  resendVerificationSchema: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.base': 'Email must be a string',
        'string.empty': 'Email is required',
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      })
  })
};

module.exports = verificationValidator;
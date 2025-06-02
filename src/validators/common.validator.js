const Joi = require('joi');

// Shared field: required email
const requiredEmail = Joi.string()
  .email()
  .required()
  .messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address'
  });

// Shared field: password
const password = Joi.string()
  .min(8)
  .max(128)
  .required()
  .messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must be less than 128 characters'
  });

// Shared field: phone number
const phone = Joi.string()
  .pattern(/^[0-9]{10}$/)
  .messages({
    'string.pattern.base': 'Phone number must be 10 digits',
    'string.empty': 'Phone number is required'
  });

// Shared field: MongoDB ObjectId
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message('Invalid ObjectId');

// Optional ObjectId
const optionalObjectId = objectId.optional();

module.exports = {
  Joi,
  requiredEmail,
  password,
  phone,
  objectId,
  optionalObjectId
};

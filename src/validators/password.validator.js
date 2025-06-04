// src/validators/password.validator.js

const Joi = require("joi");
const  commonValidators  = require("./common.validator");

const passwordValidators = {
  /**
   * Validation schema for requesting a password reset
   */
  forgotPassword: Joi.object({
    email: commonValidators.requiredEmail.required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email address is required"
    })
  }),

  /**
   * Validation schema for password reset token verification
   */
  verifyResetToken: Joi.object({
    token: Joi.string().required().messages({
      "string.empty": "Reset token is required",
      "any.required": "Reset token is required"
    })
  }),

  /**
   * Validation schema for resetting password with token
   */
  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      "string.empty": "Reset token is required",
      "any.required": "Reset token is required"
    }),
    password: commonValidators.password.required().messages({
      "string.min": "Password must be at least {#limit} characters long",
      "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      "any.required": "New password is required"
    }),
    confirmPassword: Joi.string().valid(Joi.ref("password")).required().messages({
      "any.only": "Passwords do not match",
      "any.required": "Please confirm your new password"
    })
  })
};

module.exports = passwordValidators;

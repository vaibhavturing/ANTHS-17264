const Joi = require('joi');
const { requiredEmail, password } = require('./common.validator');

// Validation middleware
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    next();
  };
}

// Login validation schema
const loginSchema = Joi.object({
  email: requiredEmail,
  password: Joi.string().required(),
  rememberMe: Joi.boolean().default(false)
});

// Register validation schema
const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: requiredEmail,
  password: password,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords must match' }),
  role: Joi.string().valid('patient', 'doctor', 'admin', 'receptionist', 'nurse')
    .default('patient'),
  hipaaTrainingCompleted: Joi.boolean()
    .when('role', {
      is: Joi.valid('doctor', 'admin', 'receptionist', 'nurse'),
      then: Joi.valid(true).required().messages({
        'any.only': 'HIPAA training is required for healthcare staff'
      }),
      otherwise: Joi.optional()
    }),
  hipaaTrainingDate: Joi.date()
    .when('hipaaTrainingCompleted', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  acceptTerms: Joi.boolean().valid(true).required()
    .messages({ 'any.only': 'You must accept the terms and conditions' }),
  acceptPrivacyPolicy: Joi.boolean().valid(true).required()
    .messages({ 'any.only': 'You must accept the privacy policy' })
});

// Password reset request validation
const forgotPasswordSchema = Joi.object({
  email: requiredEmail
});

// Password reset with token validation
const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: password,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords must match' })
});

// Refresh token validation
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

// Email verification validation
const verifyEmailSchema = Joi.object({
  token: Joi.string().required()
});

// Change password validation
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password,
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords must match' })
});

// Logout validation
const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional()
});

// Update profile validation
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  phoneNumber: Joi.string(),
  address: Joi.string(),
  dateOfBirth: Joi.date(),
  preferredLanguage: Joi.string(),
  emergencyContact: Joi.string()
});

// Export middleware functions for use in routes
module.exports = {
  registerValidator: validate(registerSchema),
  loginValidator: validate(loginSchema),
  emailVerificationValidator: validate(verifyEmailSchema),
  forgotPasswordValidator: validate(forgotPasswordSchema),
  resetPasswordValidator: validate(resetPasswordSchema),
  changePasswordValidator: validate(changePasswordSchema),
  updateProfileValidator: validate(updateProfileSchema)
};
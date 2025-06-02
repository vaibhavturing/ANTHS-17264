const Joi = require('joi'); // ✅ Always import Joi directly
const { requiredEmail, password } = require('./common.validator');

// Validation middleware generator
function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }
    next();
  };
}

// Schemas
const loginSchema = Joi.object({
  email: requiredEmail,
  password: password,
  rememberMe: Joi.boolean().default(false)
});

const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: requiredEmail,
  password: password,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords must match' }),
  role: Joi.string().valid('patient', 'doctor', 'admin', 'receptionist', 'nurse')
    .default('patient'),
  hipaaTrainingCompleted: Joi.boolean().when('role', {
    is: Joi.valid('doctor', 'admin', 'receptionist', 'nurse'),
    then: Joi.valid(true).required().messages({
      'any.only': 'HIPAA training is required for healthcare staff'
    }),
    otherwise: Joi.optional()
  }),
  hipaaTrainingDate: Joi.date().when('hipaaTrainingCompleted', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  acceptTerms: Joi.boolean().valid(true).required()
    .messages({ 'any.only': 'You must accept the terms and conditions' }),
  acceptPrivacyPolicy: Joi.boolean().valid(true).required()
    .messages({ 'any.only': 'You must accept the privacy policy' })
});

const forgotPasswordSchema = Joi.object({
  email: requiredEmail
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: password,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({ 'any.only': 'Passwords must match' })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: password,
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords must match' })
});

const logoutSchema = Joi.object({
  refreshToken: Joi.string().optional()
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  phoneNumber: Joi.string(),
  address: Joi.string(),
  dateOfBirth: Joi.date(),
  preferredLanguage: Joi.string(),
  emergencyContact: Joi.string()
});

module.exports = {
  registerValidator: validate(registerSchema),
  loginValidator: validate(loginSchema),
  emailVerificationValidator: validate(verifyEmailSchema),
  forgotPasswordValidator: validate(forgotPasswordSchema),
  resetPasswordValidator: validate(resetPasswordSchema),
  changePasswordValidator: validate(changePasswordSchema),
  updateProfileValidator: validate(updateProfileSchema)
};

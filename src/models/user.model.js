/**
 * Healthcare Management Application
 * User Model
 * 
 * Schema for managing users in the system with role-based access control
 * Includes authentication functionality and role validation
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { createSchema } = require('./baseSchema');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Valid user roles in the system
 */
const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  NURSE: 'nurse',
  PATIENT: 'patient',
  RECEPTIONIST: 'receptionist',
  BILLING: 'billing',
  LAB_TECHNICIAN: 'lab_technician'
};

/**
 * User schema definition
 */
const userSchema = createSchema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't return password in query results
  },
  role: {
    type: String,
    enum: {
      values: Object.values(ROLES),
      message: 'Role must be one of: ' + Object.values(ROLES).join(', ')
    },
    default: ROLES.PATIENT
  },
  phoneNumber: {
    type: String,
    match: [
      /^\+?[1-9]\d{9,14}$/,
      'Please provide a valid phone number'
    ]
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(dob) {
        return dob < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  profilePicture: String,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  lastLogin: Date,
  accountLocked: {
    type: Boolean,
    default: false
  },
  lockedUntil: Date,
  failedLoginAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  termsAccepted: {
    type: Boolean,
    default: false
  },
  privacyPolicyAccepted: {
    type: Boolean,
    default: false
  },
  preferredLanguage: {
    type: String,
    default: 'en'
  },
  hipaaTrainingCompleted: {
    type: Boolean,
    default: false
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNumber: String
  }
});

// Virtual field for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ emailVerified: 1 });

// Pre-save hook to hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified or is new
  if (!this.isModified('password')) return next();

  try {
    // Generate salt and hash
    const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
    this.password = await bcrypt.hash(this.password, salt);

    // If this is a password change, update passwordChangedAt
    if (!this.isNew) {
      this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second to allow for processing delays
    }

    next();
  } catch (err) {
    logger.error(`Error hashing password: ${err.message}`);
    next(err);
  }
});

/**
 * Method to compare password
 * @param {string} candidatePassword - Password to check
 * @returns {Promise<boolean>} True if password matches
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if password was changed after a token was issued
 * @param {number} JWTTimestamp - Timestamp of when JWT was issued
 * @returns {boolean} True if password was changed after token issuance
 */
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * Generate password reset token
 * @returns {string} Password reset token
 */
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Hash token and set to passwordResetToken field
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expiry time to 10 minutes
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

/**
 * Generate email verification token
 * @returns {string} Email verification token
 */
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  // Hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Set expiry time to 24 hours
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  return verificationToken;
};

/**
 * Check if user has required role
 * @param  {...string} roles - Roles to check
 * @returns {boolean} True if user has at least one of the roles
 */
userSchema.methods.hasRole = function(...roles) {
  return roles.includes(this.role);
};

/**
 * Check if user has completed HIPAA training if required
 * @returns {boolean} True if HIPAA training completed or not required
 */
userSchema.methods.hasCompletedRequiredTraining = function() {
  // HIPAA training is required for all staff except patients
  const requiresTraining = [ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, 
                           ROLES.RECEPTIONIST, ROLES.BILLING, ROLES.LAB_TECHNICIAN];
                           
  return !requiresTraining.includes(this.role) || this.hipaaTrainingCompleted;
};

const User = mongoose.model('User', userSchema);

module.exports = {
  User,
  ROLES
};
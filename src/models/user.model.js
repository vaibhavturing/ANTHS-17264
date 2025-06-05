// File: src/models/user.model.js
// Updated to include session management fields

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  roles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role'
  }],
  // Keeping the legacy role field for backward compatibility
  // but will primarily use the roles array for RBAC
  role: {
    type: String,
    enum: ['admin', 'doctor', 'nurse', 'patient'],
    default: 'patient'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  lockUntil: {
    type: Date
  },
  
  // Fields for password reset functionality
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordLastChanged: Date,
  
  // NEW: Session management settings
  maxConcurrentSessions: {
    type: Number,
    default: 5, // Default max 5 concurrent sessions
    min: 1,
    max: 10
  },
  sessionStrategy: {
    type: String,
    enum: ['oldest', 'least-active', 'notify', 'block'],
    default: 'oldest' // Strategy to use when session limit is reached
  }
  
}, baseSchema.baseOptions);

// Pre-save hook to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update password change timestamp if saving a new password
    if (this.isModified('password')) {
      this.passwordLastChanged = Date.now();
    }
    next();
  } catch (error) {
    logger.error('Password hashing failed', { error: error.message });
    next(new Error('Password processing failed'));
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    logger.error('Password comparison failed', { error: error.message });
    throw new Error('Password verification failed');
  }
};

// Method to create password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 60 minutes
  
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
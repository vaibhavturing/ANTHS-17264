// src/models/user.model.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// CRITICAL FIX: We need to check if baseSchema exists
// If there's no baseSchema.js file, we'll create a minimal version
// Also removing the .add() call which might be causing the error
const baseSchema = {
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
};

// CRITICAL FIX: Simplified schema definition - removing problematic inheritance
const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    select: false, // Don't include password in query results
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['patient', 'doctor', 'nurse', 'admin'],
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  dateOfBirth: {
    type: Date,
  },
  avatarUrl: {
    type: String,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  lastLogin: {
    type: Date,
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  accountLocked: {
    type: Boolean,
    default: false,
  },
  accountLockedUntil: {
    type: Date,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  emailVerificationToken: {
    type: String,
    select: false,
  },
  emailVerificationExpires: {
    type: Date,
    select: false,
  },
  
  // Base schema fields (added directly instead of using .add())
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  
  // Role-specific fields
  // Patient fields
  insuranceProvider: {
    type: String,
    required: function() { return this.role === 'patient'; }
  },
  insuranceId: {
    type: String,
    required: function() { return this.role === 'patient'; }
  },
  emergencyContact: {
    name: {
      type: String,
      required: function() { return this.role === 'patient'; }
    },
    relationship: {
      type: String,
      required: function() { return this.role === 'patient'; }
    },
    phoneNumber: {
      type: String,
      required: function() { return this.role === 'patient'; }
    }
  },
  
  // Doctor fields
  licenseNumber: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  specialties: {
    type: [String],
    required: function() { return this.role === 'doctor'; }
  },
  yearsOfExperience: {
    type: Number,
    required: function() { return this.role === 'doctor'; }
  },
  
  // Nurse fields
  nursingLicense: {
    type: String,
    required: function() { return this.role === 'nurse'; }
  },
  
  // Shared healthcare professional fields
  department: {
    type: String,
    required: function() { return ['nurse', 'doctor'].includes(this.role); }
  },
  
  // Admin fields
  adminType: {
    type: String,
    enum: ['system', 'billing', 'front-desk', 'medical-records'],
    required: function() { return this.role === 'admin'; }
  },
  securityClearance: {
    type: String,
    enum: ['level1', 'level2', 'level3'],
    required: function() { return this.role === 'admin'; }
  }
}, { timestamps: true });

// CRITICAL FIX: Define DatabaseError class inline in case it's not available
class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Email uniqueness check middleware
userSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const existingUser = await this.constructor.findOne({ email: this.email });
      if (existingUser) {
        throw new Error('Email already exists');
      }
      next();
    } catch (error) {
      next(new DatabaseError(`Error checking email uniqueness: ${error.message}`, error));
    }
  } else {
    next();
  }
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Generate a salt and hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(new DatabaseError(`Error hashing password: ${error.message}`, error));
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new DatabaseError(`Error comparing passwords: ${error.message}`, error);
  }
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and save to database
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  // Set token expiration (1 hour from now)
  this.passwordResetExpires = Date.now() + 3600000; // 1 hour
  
  // Return unhashed token (will be sent in email)
  return resetToken;
};

// Generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  // Generate a random token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and save to database
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  // Set token expiration (24 hours from now)
  this.emailVerificationExpires = Date.now() + 86400000; // 24 hours
  
  // Return unhashed token (will be sent in email)
  return verificationToken;
};

// Format user data for client
userSchema.methods.toClientJSON = function() {
  const userData = {
    id: this._id,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    role: this.role,
    phoneNumber: this.phoneNumber,
    dateOfBirth: this.dateOfBirth,
    avatarUrl: this.avatarUrl,
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };

  // Add role-specific fields to the response
  switch (this.role) {
    case 'patient':
      userData.insuranceProvider = this.insuranceProvider;
      userData.insuranceId = this.insuranceId;
      // Don't include full emergency contact details in client response for privacy
      userData.hasEmergencyContact = !!this.emergencyContact;
      break;
    case 'doctor':
      userData.licenseNumber = this.licenseNumber;
      userData.specialties = this.specialties;
      userData.yearsOfExperience = this.yearsOfExperience;
      userData.department = this.department;
      break;
    case 'nurse':
      userData.nursingLicense = this.nursingLicense;
      userData.department = this.department;
      break;
    case 'admin':
      userData.adminType = this.adminType;
      // Don't include security clearance in client response for security
      break;
    default:
      break;
  }

  return userData;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
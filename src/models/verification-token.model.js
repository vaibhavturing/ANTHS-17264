// src/models/verification-token.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const baseSchema = require('./baseSchema');

/**
 * Schema for email verification tokens
 * This handles the secure storage of verification tokens for account activation
 */
const verificationTokenSchema = new mongoose.Schema({
  // User ID this token belongs to
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Hashed token stored in the database for security
  token: {
    type: String,
    required: true
  },
  // When this token expires
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours by default
  },
  // Whether this token has been used
  isUsed: {
    type: Boolean,
    default: false
  },
  // Date when this token was used
  usedAt: {
    type: Date
  },
  // Token type (verification, invitation, etc.)
  type: {
    type: String,
    enum: ['verification', 'invitation'],
    default: 'verification'
  }
}, baseSchema.baseOptions);

// Indexes for faster queries
verificationTokenSchema.index({ userId: 1 });
verificationTokenSchema.index({ token: 1 });
verificationTokenSchema.index({ expiresAt: 1 });

// Set token to expire from the database after 3 days (cleanup)
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

/**
 * Static method to generate a new token
 * @param {string} userId - User ID
 * @param {string} type - Token type (verification or invitation)
 * @returns {Object} Token object with plaintext token and DB record
 */
verificationTokenSchema.statics.generateToken = async function(userId, type = 'verification') {
  // Generate a random token
  const plainTextToken = crypto.randomBytes(32).toString('hex');
  
  // Hash the token for storage
  const hashedToken = crypto
    .createHash('sha256')
    .update(plainTextToken)
    .digest('hex');
  
  // Create and save the token document
  const tokenDocument = await this.create({
    userId,
    token: hashedToken,
    type
  });
  
  return {
    plainTextToken,
    tokenDocument
  };
};

/**
 * Static method to verify a token
 * @param {string} userId - User ID
 * @param {string} plainTextToken - Token to verify
 * @returns {Promise<Object>} Verification result
 */
verificationTokenSchema.statics.verifyToken = async function(userId, plainTextToken) {
  // Hash the provided token for comparison
  const hashedToken = crypto
    .createHash('sha256')
    .update(plainTextToken)
    .digest('hex');
  
  // Find a matching token that is not expired and not used
  const tokenDocument = await this.findOne({
    userId,
    token: hashedToken,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });
  
  if (!tokenDocument) {
    return { valid: false, message: 'Token is invalid or expired' };
  }
  
  return { valid: true, token: tokenDocument };
};

/**
 * Mark a token as used
 */
verificationTokenSchema.methods.markAsUsed = async function() {
  this.isUsed = true;
  this.usedAt = new Date();
  await this.save();
};

/**
 * Invalidate all tokens for a user
 * @param {string} userId - User ID
 * @param {string} type - Token type (verification or invitation)
 */
verificationTokenSchema.statics.invalidateAllUserTokens = async function(userId, type = 'verification') {
  return this.updateMany(
    { 
      userId, 
      type,
      isUsed: false 
    },
    { 
      $set: { 
        isUsed: true, 
        usedAt: new Date() 
      } 
    }
  );
};

const VerificationToken = mongoose.model('VerificationToken', verificationTokenSchema);

module.exports = VerificationToken;
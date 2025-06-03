
// src/models/refreshToken.model.js

const mongoose = require('mongoose');

/**
 * Refresh Token Schema
 * Stores refresh tokens with reference to users, enabling token revocation
 * and tracking of active sessions
 */
const refreshTokenSchema = new mongoose.Schema({
  // The actual token value (hashed for security)
  token: {
    type: String,
    required: true,
    index: true
  },
  
  // Reference to the user this token belongs to
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Token unique identifier (jti claim from JWT)
  jti: {
    type: String,
    required: true,
    index: true
  },
  
  // User agent info for tracking device/browser
  userAgent: {
    type: String
  },
  
  // IP address for security auditing
  ipAddress: {
    type: String
  },
  
  // When this token was issued
  issuedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  // When this token expires
  expiresAt: {
    type: Date,
    required: true
  },
  
  // If the token has been revoked
  isRevoked: {
    type: Boolean,
    default: false
  },
  
  // When the token was revoked
  revokedAt: {
    type: Date
  },
  
  // Why the token was revoked
  revokedReason: {
    type: String
  }
}, { timestamps: true });

// Index for quickly finding and cleaning expired tokens
refreshTokenSchema.index({ expiresAt: 1 });

// Index for finding tokens by user and status
refreshTokenSchema.index({ user: 1, isRevoked: 1 });

// Helper method to check if token is expired
refreshTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt;
};

// Helper method to revoke a token
refreshTokenSchema.methods.revoke = function(reason = 'Manually revoked') {
  this.isRevoked = true;
  this.revokedAt = new Date();
  this.revokedReason = reason;
  return this.save();
};

// Static method to clean up expired tokens
refreshTokenSchema.statics.removeExpired = async function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to find valid token
refreshTokenSchema.statics.findValidToken = async function(jti, userId) {
  return this.findOne({
    jti,
    user: userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to revoke all tokens for a user
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId, reason = 'Security policy') {
  return this.updateMany(
    { user: userId, isRevoked: false },
    { 
      isRevoked: true, 
      revokedAt: new Date(),
      revokedReason: reason
    }
  );
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
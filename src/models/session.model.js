// File: src/models/session.model.js
// New file for session management models

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Session Schema for tracking active user sessions
 * Used for session management, concurrent session control,
 * and providing users with visibility into their logged-in devices
 */
const sessionSchema = new mongoose.Schema({
  // Reference to the user this session belongs to
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // The JWT token identifier (jti claim)
  tokenId: {
    type: String,
    required: true,
    unique: true
  },
  
  // User agent and device information
  userAgent: {
    type: String,
    required: true
  },
  
  // IP address of the client
  ipAddress: {
    type: String,
    required: true
  },
  
  // Optional device name (can be set by user for easier identification)
  deviceName: {
    type: String,
    default: 'Unknown device'
  },
  
  // Location information (if available)
  location: {
    type: String,
    default: 'Unknown location'
  },
  
  // Last activity timestamp (updated on token refresh)
  lastActive: {
    type: Date,
    default: Date.now
  },
  
  // When the session expires
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  
  // If the session was manually invalidated by the user or admin
  isRevoked: {
    type: Boolean,
    default: false
  }
}, baseSchema.baseOptions);

// Index for faster querying of active sessions
sessionSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

// Method to update last activity timestamp
sessionSchema.methods.updateLastActive = async function() {
  this.lastActive = Date.now();
  return this.save();
};

// Method to revoke/invalidate this session
sessionSchema.methods.revoke = async function() {
  this.isRevoked = true;
  return this.save();
};

// Static method to clean up expired sessions
sessionSchema.statics.cleanupExpiredSessions = async function() {
  try {
    const result = await this.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    logger.info(`Cleaned up ${result.deletedCount || 0} expired sessions`);
    return result;
  } catch (error) {
    logger.error('Failed to clean up expired sessions', { error: error.message });
    throw error;
  }
};

// Static method to get active sessions for a user
sessionSchema.statics.getActiveSessions = async function(userId) {
  return this.find({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActive: -1 });
};

// Static method to count active sessions for a user
sessionSchema.statics.countActiveSessions = async function(userId) {
  return this.countDocuments({
    userId,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to get a session by token ID
sessionSchema.statics.findByTokenId = async function(tokenId) {
  return this.findOne({
    tokenId,
    isRevoked: false,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to revoke all sessions for a user except current one
sessionSchema.statics.revokeAllExcept = async function(userId, currentTokenId) {
  try {
    const result = await this.updateMany(
      {
        userId,
        tokenId: { $ne: currentTokenId },
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      },
      { isRevoked: true }
    );
    
    logger.info(`Revoked ${result.modifiedCount} sessions for user ${userId}`);
    return result;
  } catch (error) {
    logger.error('Failed to revoke all sessions', { error: error.message, userId });
    throw error;
  }
};

// Static method to check if token is revoked
sessionSchema.statics.isTokenRevoked = async function(tokenId) {
  const session = await this.findOne({ tokenId });
  return !session || session.isRevoked || session.expiresAt < new Date();
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
// File: src/models/token-blacklist.model.js
// New file for token blacklisting model

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Token Blacklist Schema for tracking invalidated tokens
 * Used for logout functionality and token revocation
 */
const tokenBlacklistSchema = new mongoose.Schema({
  // The JWT token identifier (jti claim)
  tokenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // When the token expires
  expiresAt: {
    type: Date,
    required: true,
    index: true
  }
}, baseSchema.baseOptions);

// Static method to add a token to the blacklist
tokenBlacklistSchema.statics.blacklist = async function(tokenId, expiresAt) {
  try {
    const entry = await this.create({
      tokenId,
      expiresAt
    });
    
    logger.info(`Token blacklisted`, { tokenId });
    return entry;
  } catch (error) {
    // If duplicate key error, token is already blacklisted
    if (error.code === 11000) {
      logger.warn(`Token already blacklisted`, { tokenId });
      return true;
    }
    logger.error('Failed to blacklist token', { error: error.message, tokenId });
    throw error;
  }
};

// Static method to check if a token is blacklisted
tokenBlacklistSchema.statics.isBlacklisted = async function(tokenId) {
  const entry = await this.findOne({ tokenId });
  return !!entry;
};

// Static method to clean up expired tokens
tokenBlacklistSchema.statics.cleanupExpiredTokens = async function() {
  try {
    const result = await this.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    logger.info(`Cleaned up ${result.deletedCount || 0} expired blacklisted tokens`);
    return result;
  } catch (error) {
    logger.error('Failed to clean up expired blacklisted tokens', { error: error.message });
    throw error;
  }
};

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

module.exports = TokenBlacklist;
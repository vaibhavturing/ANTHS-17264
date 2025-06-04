// src/utils/token.util.js

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { DatabaseError, AuthenticationError } = require('./errors');
const logger = require('./logger');

/**
 * Utility functions for token generation and management
 * specifically for password reset functionality
 */
const tokenUtil = {
  /**
   * Generates a secure random token for password reset
   * @returns {string} The generated token
   */
  generateResetToken: () => {
    // Generate a secure random token using crypto
    return crypto.randomBytes(32).toString('hex');
  },
  
  /**
   * Hash a token for secure storage in the database
   * @param {string} token - The token to hash
   * @returns {string} The hashed token
   */
  hashToken: (token) => {
    return crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  },
  
  /**
   * Creates a JWT token with embedded user data and expiration
   * @param {Object} data - Data to embed in the token
   * @param {string} expiresIn - Token expiration time (e.g., '1h')
   * @returns {string} The generated JWT token
   */
  createJWT: (data, expiresIn = '1h') => {
    try {
      return jwt.sign(data, config.JWT_SECRET, { expiresIn });
    } catch (error) {
      logger.error('Failed to create JWT token', { error: error.message });
      throw new AuthenticationError('Failed to create authentication token');
    }
  },
  
  /**
   * Verify a JWT token
   * @param {string} token - The JWT token to verify
   * @returns {Object} The decoded token payload
   */
  verifyJWT: (token) => {
    try {
      return jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
      logger.error('Invalid or expired token', { error: error.message });
      throw new AuthenticationError('Invalid or expired token');
    }
  },
  
  /**
   * Calculate token expiration date
   * @param {number} minutes - Minutes until token expiration
   * @returns {Date} The expiration date
   */
  calculateExpiryTime: (minutes = 60) => {
    return new Date(Date.now() + minutes * 60 * 1000);
  }
};

module.exports = tokenUtil;
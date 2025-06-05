const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Utility for token generation and verification
 */
const authUtil = {
  /**
   * Generate JWT access token
   * @param {Object} payload - Token payload
   * @param {string} tokenId - Optional token ID, will generate if not provided
   * @returns {string} JWT token
   */
  generateAccessToken: (payload, tokenId = null) => {
    try {
      // Generate a token ID if not provided
      const jti = tokenId || uuidv4();
      
      return jwt.sign(
        {...payload, jti},
        config.JWT_SECRET,
        {
          expiresIn: config.JWT_ACCESS_EXPIRATION
        }
      );
    } catch (error) {
      logger.error('Access token generation failed', { error: error.message });
      throw new Error('Failed to generate access token');
    }
  },

  /**
   * Generate JWT refresh token
   * @param {Object} payload - Token payload
   * @returns {string} JWT refresh token
   */
  generateRefreshToken: (payload) => {
    try {
      // Always generate a new token ID for refresh tokens
      const jti = uuidv4();
      
      return jwt.sign(
        {...payload, jti},
        config.JWT_REFRESH_SECRET,
        {
          expiresIn: config.JWT_REFRESH_EXPIRATION
        }
      );
    } catch (error) {
      logger.error('Refresh token generation failed', { error: error.message });
      throw new Error('Failed to generate refresh token');
    }
  },

  /**
   * Verify JWT access token
   * @param {string} token - JWT token to verify
   * @returns {Object} Decoded payload or null if invalid
   */
  verifyAccessToken: (token) => {
    try {
      return jwt.verify(token, config.JWT_SECRET);
    } catch (error) {
      logger.warn('Access token verification failed', { error: error.message });
      return null;
    }
  },

  /**
   * Verify JWT refresh token
   * @param {string} token - JWT refresh token to verify
   * @returns {Object} Decoded payload or null if invalid
   */
  verifyRefreshToken: (token) => {
    try {
      return jwt.verify(token, config.JWT_REFRESH_SECRET);
    } catch (error) {
      logger.warn('Refresh token verification failed', { error: error.message });
      return null;
    }
  },

  /**
   * Hash a string (e.g., for storing refresh tokens)
   * @param {string} data - Data to hash
   * @returns {string} Hashed string
   */
  hashData: (data) => {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  },

  /**
   * Extract JWT token from request
   * @param {Object} req - Express request object
   * @returns {string|null} JWT token or null
   */
  extractToken: (req) => {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      return req.headers.authorization.split(' ')[1];
    }
    
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }
    
    return null;
  }
};

module.exports = authUtil;
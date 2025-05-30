/**
 * Healthcare Management Application
 * Authentication Utilities
 * 
 * Provides token generation, verification and other authentication utilities
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const config = require('../config/config');
const { UnauthorizedError } = require('./api-error.util');
const logger = require('./logger');

/**
 * Generate JWT token
 * @param {Object} payload - Data to include in the token
 * @param {String} expiresIn - Token expiration time (e.g. '1h', '7d')
 * @returns {String} JWT token
 */
const generateToken = (payload, expiresIn = config.jwt.expiresIn) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: expiresIn
  });
};

/**
 * Verify JWT token
 * @param {String} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = async (token) => {
  try {
    // Convert callback-based jwt.verify to Promise-based
    const decoded = await promisify(jwt.verify)(token, config.jwt.secret);
    return decoded;
  } catch (error) {
    logger.error(`Token verification failed: ${error.message}`);
    
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Your token has expired. Please log in again.');
    }
    
    throw new UnauthorizedError('Invalid token. Please log in again.');
  }
};

/**
 * Generate a random token
 * @param {Number} byteLength - Length of the random bytes
 * @returns {String} Hex encoded random token
 */
const generateRandomToken = (byteLength = 32) => {
  return crypto.randomBytes(byteLength).toString('hex');
};

/**
 * Create a hashed token for password reset or email verification
 * @param {String} token - Token to hash
 * @returns {String} Hashed token
 */
const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Extract token from request
 * @param {Object} req - Express request object
 * @returns {String|null} JWT token or null if not found
 */
const getTokenFromRequest = (req) => {
  // Check authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    const token = req.headers.authorization.split(' ')[1];
    if (token) return token;
  }
  
  // Check cookies
  if (req.cookies && req.cookies.jwt) {
    return req.cookies.jwt;
  }
  
  // No token found
  return null;
};

/**
 * Set JWT cookie
 * @param {Object} res - Express response object
 * @param {String} token - JWT token
 * @param {Boolean} secure - Whether cookie should be secure (HTTPS only)
 * @returns {Object} Express response object
 */
const sendTokenCookie = (res, token) => {
  // Calculate expiration
  const expirationDays = parseInt(config.jwt.cookieExpiresIn, 10);
  const expiresIn = new Date(
    Date.now() + expirationDays * 24 * 60 * 60 * 1000
  );

  const cookieOptions = {
    expires: expiresIn,
    httpOnly: true, // Cannot be accessed by JavaScript
    sameSite: 'strict', // Strict same-site policy
    secure: config.env === 'production', // HTTPS only in production
    path: '/' // Available across the domain
  };

  return res.cookie('jwt', token, cookieOptions);
};

/**
 * Clear JWT cookie (for logout)
 * @param {Object} res - Express response object
 * @returns {Object} Express response object
 */
const clearTokenCookie = (res) => {
  return res.cookie('jwt', 'logged-out', {
    expires: new Date(Date.now() + 10 * 1000), // 10 seconds
    httpOnly: true,
    sameSite: 'strict'
  });
};

module.exports = {
  generateToken,
  verifyToken,
  generateRandomToken,
  hashToken,
  getTokenFromRequest,
  sendTokenCookie,
  clearTokenCookie
};
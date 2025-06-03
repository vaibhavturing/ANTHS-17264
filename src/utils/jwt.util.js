// src/utils/jwt.util.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * JWT utility functions for token generation and verification
 * Used for authentication and authorization in the Healthcare Management Application
 */

// Get JWT configuration from environment or use defaults
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-token-secret-dev-only';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret-dev-only';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

/**
 * Generate an access token for authenticated user
 * @param {Object} user - User data to include in token payload
 * @returns {String} Signed JWT token
 */
const generateAccessToken = (user) => {
  // Create payload with user information and JWT claims
  const payload = {
    sub: user._id, // subject (user ID)
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    // Standard JWT claims
    iat: Math.floor(Date.now() / 1000), // issued at time
    // Include role-specific data as needed
    ...(user.role === 'doctor' && { specialties: user.specialties }),
    ...(user.role === 'admin' && { adminType: user.adminType })
  };

  // Sign the token with secret and expiry
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

/**
 * Generate a refresh token for extended sessions
 * @param {String} userId - User ID 
 * @returns {String} Signed refresh token
 */
const generateRefreshToken = (userId) => {
  const payload = {
    sub: userId,
    // Type helps differentiate token types for security
    type: 'refresh',
    // Random token ID to allow revocation of specific tokens
    jti: crypto.randomBytes(16).toString('hex'),
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

/**
 * Verify an access token
 * @param {String} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Verify a refresh token
 * @param {String} token - Refresh token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    // Additional check to ensure it's a refresh token
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Extract token from request
 * Checks Authorization header and cookies
 * @param {Object} req - Express request object
 * @returns {String|null} Token or null if not found
 */
const extractTokenFromRequest = (req) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  if (req.cookies && req.cookies.accessToken) {
    return req.cookies.accessToken;
  }
  
  return null;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractTokenFromRequest
};
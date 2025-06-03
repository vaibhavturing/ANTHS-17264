// src/services/auth.service.js

const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} = require('../utils/jwt.util');

// Define error classes inline to avoid dependencies
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AuthenticationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class AccountLockedError extends AuthenticationError {
  constructor(until) {
    const message = 'Account is locked due to too many failed login attempts';
    super(message);
    this.lockExpiresAt = until;
    this.details = { lockExpiresAt: until };
  }
}

class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BusinessLogicError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'BusinessLogicError';
    this.statusCode = 422;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Simple logging function for audit (can be replaced with your actual audit logger)
const auditLog = (data) => {
  console.log('[AUDIT]', JSON.stringify(data));
};

// Calculate token expiry date from JWT expiry string (e.g., '7d', '24h')
const calculateExpiryDate = (expiryString) => {
  const matches = expiryString.match(/^(\d+)([smhdw])$/);
  if (!matches) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days
  
  const value = parseInt(matches[1]);
  const unit = matches[2];
  
  let milliseconds = 0;
  switch (unit) {
    case 's': milliseconds = value * 1000; break;
    case 'm': milliseconds = value * 60 * 1000; break;
    case 'h': milliseconds = value * 60 * 60 * 1000; break;
    case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
    case 'w': milliseconds = value * 7 * 24 * 60 * 60 * 1000; break;
    default: milliseconds = 7 * 24 * 60 * 60 * 1000; // Default 7 days
  }
  
  return new Date(Date.now() + milliseconds);
};

// Hash a refresh token for secure storage
const hashRefreshToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

class AuthService {
  /**
   * Register a new user with role-specific validation
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Newly created user
   */
  async register(userData) {
    try {
      // Check if email already exists (this pre-check can help provide a clearer error)
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new ValidationError('Email is already registered');
      }

      // Create new user
      const user = new User(userData);
      
      // Generate email verification token if the method exists
      if (typeof user.generateEmailVerificationToken === 'function') {
        user.generateEmailVerificationToken();
      }
      
      // Save user to database
      await user.save();
      
      // Log registration audit event
      auditLog({
        action: 'USER_REGISTER',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id,
        details: {
          role: user.role,
          emailVerified: user.emailVerified
        }
      });
      
      // Return user data without sensitive information
      // Check if toClientJSON method exists
      if (typeof user.toClientJSON === 'function') {
        return user.toClientJSON();
      }
      
      // Fallback if method doesn't exist
      return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      };
    } catch (error) {
      // Handle different types of errors
      if (error.name === 'ValidationError') {
        throw new ValidationError('Validation error', error);
      } else if (error.code === 11000) {
        throw new ValidationError('Email is already registered');
      } else if (error instanceof ValidationError || 
                error instanceof AuthenticationError || 
                error instanceof BusinessLogicError) {
        throw error;
      } else {
        throw new DatabaseError('Error registering new user', error);
      }
    }
  }

  /**
   * ADDED: Login a user with email and password
   * @param {Object} credentials - Login credentials
   * @param {String} credentials.email - User email
   * @param {String} credentials.password - User password
   * @param {Boolean} credentials.rememberMe - Extended session flag
   * @param {String} ipAddress - Client IP address
   * @param {String} userAgent - Client user agent string
   * @returns {Promise<Object>} Authentication tokens and user data
   */
  async login({ email, password, rememberMe = false }, ipAddress, userAgent) {
    try {
      // Find user by email
      const user = await User.findOne({ email }).select('+password');
      
      // If user not found
      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }
      
      // Check if user is active
      if (!user.isActive) {
        throw new AuthenticationError('Account is inactive or disabled');
      }
      
      // Check if user email is verified (optional, enable if required)
      if (!user.emailVerified) {
        throw new AuthenticationError('Email not verified. Please verify your email before logging in.');
      }
      
      // Check if account is locked
      if (user.isAccountLocked()) {
        // Record failed login
        user.recordLoginAttempt(false, ipAddress, userAgent);
        await user.save();
        
        throw new AccountLockedError(user.accountLockedUntil);
      }
      
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      
      // Record login attempt (success or failure)
      user.recordLoginAttempt(isPasswordValid, ipAddress, userAgent);
      
      // If password invalid
      if (!isPasswordValid) {
        await user.save();
        throw new AuthenticationError('Invalid email or password');
      }
      
      // Generate authentication tokens
      const accessToken = generateAccessToken(user);
      const refreshTokenString = generateRefreshToken(user._id);
      
      // Parse JWT payload to get jti and expiry
      const decoded = verifyRefreshToken(refreshTokenString);
      if (!decoded) {
        throw new Error('Failed to generate valid refresh token');
      }
      
      // Handle refresh token expiry - use environment setting or default
      const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
      const expiresAt = calculateExpiryDate(REFRESH_TOKEN_EXPIRY);
      
      // Create refresh token record
      const refreshToken = new RefreshToken({
        token: hashRefreshToken(refreshTokenString),
        user: user._id,
        jti: decoded.jti,
        userAgent,
        ipAddress,
        expiresAt
      });
      
      // Save refresh token and updated user
      await Promise.all([refreshToken.save(), user.save()]);
      
      // Log successful login
      auditLog({
        action: 'USER_LOGIN',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id,
        details: {
          role: user.role,
          ipAddress,
          userAgent
        }
      });
      
      // Return tokens and user data
      return {
        accessToken,
        refreshToken: refreshTokenString,
        user: user.toClientJSON(),
        tokenExpiry: {
          issued: new Date(),
          expires: expiresAt
        }
      };
    } catch (error) {
      // Re-throw auth errors directly
      if (error instanceof AuthenticationError || 
          error instanceof ValidationError) {
        throw error;
      }
      
      // Log unexpected errors
      console.error('Login error:', error);
      throw new DatabaseError('Error during login', error);
    }
  }

  /**
   * ADDED: Refresh access token using refresh token
   * @param {String} refreshToken - Refresh token string
   * @param {String} ipAddress - Client IP address
   * @param {String} userAgent - Client user agent string
   * @returns {Promise<Object>} New access token
   */
  async refreshToken(refreshToken, ipAddress, userAgent) {
    try {
      // Verify refresh token JWT
      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded) {
        throw new AuthenticationError('Invalid refresh token');
      }
      
      // Get user ID and token ID from payload
      const { sub: userId, jti } = decoded;
      
      // Find the stored refresh token
      const storedToken = await RefreshToken.findValidToken(jti, userId);
      
      if (!storedToken) {
        throw new AuthenticationError('Refresh token expired or revoked');
      }
      
      // Get the user
      const user = await User.findById(userId);
      if (!user || !user.isActive) {
        await storedToken.revoke('User not found or inactive');
        throw new AuthenticationError('User not found or inactive');
      }
      
      // Check if token version matches (for forced logout)
      if (decoded.tokenVersion !== undefined && 
          user.tokenVersion > decoded.tokenVersion) {
        await storedToken.revoke('Token version mismatch - forced logout');
        throw new AuthenticationError('Session expired. Please login again.');
      }
      
      // Generate new access token
      const accessToken = generateAccessToken(user);
      
      // Update token's last used information
      storedToken.lastUsedAt = new Date();
      storedToken.lastUsedIp = ipAddress;
      await storedToken.save();
      
      // Log token refresh
      auditLog({
        action: 'TOKEN_REFRESH',
        actor: { id: user._id, email: user.email },
        resource: 'RefreshToken',
        resourceId: storedToken._id,
        details: { ipAddress, userAgent }
      });
      
      return {
        accessToken,
        user: user.toClientJSON()
      };
    } catch (error) {
      // Re-throw auth errors directly
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new DatabaseError('Error refreshing token', error);
    }
  }

  /**
   * ADDED: Logout a user
   * @param {String} refreshToken - Refresh token to revoke
   * @param {Boolean} allDevices - Whether to revoke all refresh tokens for the user
   * @param {Object} user - User object from request
   * @returns {Promise<Boolean>} Success status
   */
  async logout(refreshToken, allDevices = false, user) {
    try {
      if (!refreshToken && !user) {
        return true; // Nothing to do
      }
      
      // If we have a refresh token, revoke it
      if (refreshToken) {
        // Verify token first
        const decoded = verifyRefreshToken(refreshToken);
        
        if (decoded) {
          const { sub: userId, jti } = decoded;
          
          // Find token in database
          const token = await RefreshToken.findOne({ 
            jti,
            user: userId,
            isRevoked: false 
          });
          
          // Revoke the token if found
          if (token) {
            await token.revoke('User logout');
          }
          
          // If we need to revoke all devices for this user
          if (allDevices) {
            // Get the user if not provided
            const userToUpdate = user || await User.findById(userId);
            
            if (userToUpdate) {
              // Increment token version to invalidate all tokens
              userToUpdate.incrementTokenVersion();
              await userToUpdate.save();
              
              // Revoke all tokens for this user
              await RefreshToken.revokeAllUserTokens(userId, 'Logout from all devices requested');
              
              // Log all-device logout
              auditLog({
                action: 'USER_LOGOUT_ALL_DEVICES',
                actor: { id: userToUpdate._id, email: userToUpdate.email },
                resource: 'User',
                resourceId: userToUpdate._id
              });
            }
          } else {
            // Log single-device logout
            auditLog({
              action: 'USER_LOGOUT',
              actor: { id: userId },
              resource: 'RefreshToken',
              resourceId: jti
            });
          }
        }
      }
      // If we have user but no token, and all devices requested
      else if (user && allDevices) {
        // Increment token version to invalidate all tokens
        user.incrementTokenVersion();
        await user.save();
        
        // Revoke all tokens for this user
        await RefreshToken.revokeAllUserTokens(user._id, 'Logout from all devices requested');
        
        // Log all-device logout
        auditLog({
          action: 'USER_LOGOUT_ALL_DEVICES',
          actor: { id: user._id, email: user.email },
          resource: 'User',
          resourceId: user._id
        });
      }
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Always return success to client even if there's an error
      return true;
    }
  }

  /**
   * Verify a user's email address
   * @param {string} token - Email verification token
   * @returns {Promise<Object>} Updated user
   */
  async verifyEmail(token) {
    try {
      // Find user by verification token
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new ValidationError('Invalid or expired verification token');
      }

      // Update user verification status
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      
      await user.save();
      
      // Log email verification audit event
      auditLog({
        action: 'EMAIL_VERIFY',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id
      });
      
      // Return user data
      if (typeof user.toClientJSON === 'function') {
        return user.toClientJSON();
      }
      
      return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Error verifying email', error);
    }
  }

  /**
   * Request password reset email
   * @param {string} email - User email address
   * @returns {Promise<boolean>} Success status
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email });
      
      // Even if user not found, return success to prevent email enumeration
      if (!user) return true;
      
      // Generate reset token if the method exists
      if (typeof user.generatePasswordResetToken === 'function') {
        user.generatePasswordResetToken();
        await user.save();
      }
      
      // TODO: Send password reset email
      
      // Log password reset request audit event
      auditLog({
        action: 'PASSWORD_RESET_REQUEST',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id
      });
      
      return true;
    } catch (error) {
      throw new DatabaseError('Error requesting password reset', error);
    }
  }

  /**
   * Reset password with token
   * @param {string} token - Password reset token
   * @param {string} newPassword - New password
   * @returns {Promise<boolean>} Success status
   */
  async resetPassword(token, newPassword) {
    try {
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new ValidationError('Invalid or expired reset token');
      }

      // Update password
      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      
      // Reset failed login attempts
      user.failedLoginAttempts = 0;
      user.accountLocked = false;
      user.accountLockedUntil = undefined;
      user.accountLockedReason = undefined;
      
      // Increment token version to invalidate all existing sessions
      user.incrementTokenVersion();
      
      await user.save();
      
      // Revoke all refresh tokens for security
      await RefreshToken.revokeAllUserTokens(user._id, 'Password reset - security measure');
      
      // Log password reset audit event
      auditLog({
        action: 'PASSWORD_RESET',
        actor: { id: user._id, email: user.email },
        resource: 'User',
        resourceId: user._id
      });
      
      return true;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Error resetting password', error);
    }
  }
}

module.exports = new AuthService();
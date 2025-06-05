// File: src/services/auth.service.js
// Updated to integrate with session management

const User = require('../models/user.model');
const authUtil = require('../utils/auth.util');
const sessionService = require('./session.service');
const { AuthenticationError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Authentication service
 */
const authService = {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registered user and tokens
   */
  register: async (userData) => {
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ email: userData.email });
      
      if (existingUser) {
        throw new AuthenticationError('Email already registered');
      }
      
      // Create user with minimal required data
      const user = new User({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'patient'
      });
      
      await user.save();
      
      logger.info(`User registered: ${userData.email}`, { userId: user._id });
      
      // Create a session and generate token
      const { session, tokenId } = await sessionService.createSession(
        user._id, 
        {
          userAgent: userData.userAgent,
          ipAddress: userData.ipAddress
        }
      );
      
      // Generate tokens
      const accessToken = authUtil.generateAccessToken(
        { id: user._id, role: user.role },
        tokenId
      );
      
      const refreshToken = authUtil.generateRefreshToken({ id: user._id });
      
      return {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken
        },
        session: session._id
      };
    } catch (error) {
      logger.error('Registration failed', { error: error.message });
      throw error;
    }
  },

  /**
   * Authenticate a user by email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {Object} meta - Request metadata (IP, user agent)
   * @returns {Promise<Object>} Authenticated user and tokens
   */
  login: async (email, password, meta = {}) => {
    try {
      // Find user by email and include password for verification
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
        logger.warn(`Login failed - Email not found: ${email}`);
        throw new AuthenticationError('Invalid email or password');
      }
      
      // Check if account is locked
      if (user.accountLocked) {
        if (user.lockUntil && user.lockUntil > Date.now()) {
          const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
          logger.warn(`Login attempted for locked account: ${email}`);
          throw new AuthenticationError(
            `Account locked. Try again in ${minutesLeft} minutes.`
          );
        } else {
          // Lock period expired, reset the lock
          user.accountLocked = false;
          user.failedLoginAttempts = 0;
          await user.save();
        }
      }
      
      // Check if user is active
      if (!user.isActive) {
        logger.warn(`Login attempted for inactive account: ${email}`);
        throw new AuthenticationError('Account is inactive');
      }
      
      // Verify password
      const isMatch = await user.comparePassword(password);
      
      if (!isMatch) {
        // Increment failed login attempts
        user.failedLoginAttempts += 1;
        
        // Lock account after 5 failed attempts
        if (user.failedLoginAttempts >= 5) {
          user.accountLocked = true;
          user.lockUntil = new Date(Date.now() + 15 * 60000); // 15 minutes
          logger.warn(`Account locked after 5 failed attempts: ${email}`);
        }
        
        await user.save();
        
        logger.warn(`Login failed - Invalid password for: ${email}`, {
          failedAttempts: user.failedLoginAttempts
        });
        throw new AuthenticationError('Invalid email or password');
      }
      
      // Reset failed login attempts on successful login
      if (user.failedLoginAttempts > 0) {
        user.failedLoginAttempts = 0;
        user.accountLocked = false;
        user.lockUntil = null;
        await user.save();
      }
      
      // Create a session and generate token ID
      const { session, tokenId } = await sessionService.createSession(
        user._id, 
        {
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
          location: meta.location
        }
      );
      
      // Generate tokens
      const accessToken = authUtil.generateAccessToken(
        { id: user._id, role: user.role },
        tokenId
      );
      const refreshToken = authUtil.generateRefreshToken({ id: user._id });
      
      logger.info(`User logged in: ${email}`, { userId: user._id });
      
      return {
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        tokens: {
          accessToken,
          refreshToken
        },
        session: session._id
      };
    } catch (error) {
      logger.error('Login failed', { error: error.message, email });
      throw error;
    }
  },

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Current refresh token
   * @param {Object} meta - Request metadata
   * @returns {Promise<Object>} New access and refresh tokens
   */
  refreshToken: async (refreshToken, meta = {}) => {
    try {
      // Verify the refresh token
      const decoded = authUtil.verifyRefreshToken(refreshToken);
      
      if (!decoded) {
        throw new AuthenticationError('Invalid refresh token');
      }
      
      // Get user
      const user = await User.findById(decoded.id);
      
      if (!user || !user.isActive) {
        throw new AuthenticationError('User not found or inactive');
      }
      
      // Create a new session
      const { session, tokenId } = await sessionService.createSession(
        user._id, 
        {
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
          location: meta.location
        }
      );
      
      // Generate new tokens
      const accessToken = authUtil.generateAccessToken(
        { id: user._id, role: user.role },
        tokenId
      );
      const newRefreshToken = authUtil.generateRefreshToken({ id: user._id });
      
      logger.info(`Token refreshed for user`, { userId: user._id });
      
      return {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken
        },
        session: session._id
      };
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message });
      throw error;
    }
  },

  /**
   * Logout a user by invalidating their session
   * @param {string} userId - User ID
   * @param {string} tokenId - Current token ID to invalidate
   * @returns {Promise<Object>} Success message
   */
  logout: async (userId, tokenId) => {
    try {
      // Find session by token ID
      const sessions = await sessionService.getUserActiveSessions(userId);
      
      const session = sessions.find(s => s.tokenId === tokenId);
      
      if (session) {
        // Revoke the session
        await sessionService.revokeSession(session._id);
      }
      
      logger.info(`User logged out`, { userId, tokenId });
      
      return {
        success: true,
        message: 'Successfully logged out'
      };
    } catch (error) {
      logger.error('Logout failed', { error: error.message, userId });
      throw error;
    }
  },

  /**
   * Verify user's email address
   * @param {string} token - Verification token
   * @returns {Promise<Object>} Success message
   */
  verifyEmail: async (token) => {
    try {
      // Implementation would depend on your verification flow
      // This is a placeholder for the email verification logic
      
      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      logger.error('Email verification failed', { error: error.message });
      throw error;
    }
  },

  /**
   * Change user's password and invalidate all sessions
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} currentSessionId - Current session ID to keep active
   * @returns {Promise<Object>} Success message
   */
  changePassword: async (userId, currentPassword, newPassword, currentSessionId) => {
    try {
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      
      if (!isMatch) {
        logger.warn(`Password change failed - Incorrect current password`, { userId });
        throw new AuthenticationError('Current password is incorrect');
      }
      
      // Update password
      user.password = newPassword;
      await user.save();
      
      // Revoke all other sessions
      if (currentSessionId) {
        await sessionService.revokeAllOtherSessions(userId, currentSessionId);
      }
      
      logger.info(`Password changed for user`, { userId });
      
      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Password change failed', { error: error.message, userId });
      throw error;
    }
  }
};

module.exports = authService;
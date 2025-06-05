// File: src/services/session.service.js
// New service for managing user sessions

const User = require('../models/user.model');
const Session = require('../models/session.model');
const TokenBlacklist = require('../models/token-blacklist.model');
const logger = require('../utils/logger');
const config = require('../config/config');
const { v4: uuidv4 } = require('uuid');

/**
 * Service for managing user sessions
 */
const sessionService = {
  /**
   * Create a new session record for a user
   * @param {Object} userId - User ID 
   * @param {Object} sessionData - Session data (IP, user agent, etc.)
   * @returns {Promise<Object>} Created session with token ID
   */
  createSession: async (userId, sessionData) => {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check for maximum concurrent sessions
      const activeSessions = await Session.countActiveSessions(userId);
      
      if (activeSessions >= user.maxConcurrentSessions) {
        // Handle the session limit based on user's strategy
        await sessionService.handleSessionLimitExceeded(user, activeSessions);
      }

      // Generate a unique token ID for this session
      const tokenId = uuidv4();
      
      // Calculate token expiration date
      const tokenExpiration = new Date();
      tokenExpiration.setSeconds(
        tokenExpiration.getSeconds() + config.JWT_ACCESS_EXPIRATION
      );
      
      // Create session record
      const session = await Session.create({
        userId,
        tokenId,
        userAgent: sessionData.userAgent || 'Unknown',
        ipAddress: sessionData.ipAddress || 'Unknown',
        deviceName: sessionService.determineDeviceName(sessionData.userAgent),
        location: sessionData.location || 'Unknown',
        expiresAt: tokenExpiration
      });
      
      logger.info(`Created new session for user`, { userId, tokenId });
      return {
        session,
        tokenId
      };
    } catch (error) {
      logger.error('Failed to create session', { error: error.message, userId });
      throw error;
    }
  },

  /**
   * Handle exceeding maximum concurrent sessions based on user's strategy
   * @param {Object} user - User object
   * @param {number} currentCount - Current active session count
   */
  handleSessionLimitExceeded: async (user, currentCount) => {
    try {
      switch (user.sessionStrategy) {
        case 'block':
          // Don't allow new sessions, throw error
          logger.warn(`New session blocked - limit reached`, { 
            userId: user._id, 
            maxSessions: user.maxConcurrentSessions,
            currentCount 
          });
          throw new Error(`Maximum session limit (${user.maxConcurrentSessions}) reached. Please log out from another device.`);
          
        case 'notify':
          // Allow but will notify user (no action needed here)
          logger.info(`Session limit reached but allowing (notify strategy)`, { 
            userId: user._id,
            currentCount 
          });
          break;
          
        case 'oldest':
          // Automatically invalidate oldest session
          const oldestSession = await Session.findOne({
            userId: user._id,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
          }).sort({ createdAt: 1 });
          
          if (oldestSession) {
            await sessionService.revokeSession(oldestSession._id);
            logger.info(`Auto-revoked oldest session due to limit`, { 
              userId: user._id, 
              sessionId: oldestSession._id 
            });
          }
          break;
          
        case 'least-active':
          // Automatically invalidate least recently active session
          const leastActiveSession = await Session.findOne({
            userId: user._id,
            isRevoked: false,
            expiresAt: { $gt: new Date() }
          }).sort({ lastActive: 1 });
          
          if (leastActiveSession) {
            await sessionService.revokeSession(leastActiveSession._id);
            logger.info(`Auto-revoked least active session due to limit`, { 
              userId: user._id, 
              sessionId: leastActiveSession._id 
            });
          }
          break;
          
        default:
          logger.warn(`Unknown session strategy, defaulting to block`, {
            strategy: user.sessionStrategy,
            userId: user._id
          });
          throw new Error(`Maximum session limit (${user.maxConcurrentSessions}) reached. Please log out from another device.`);
      }
    } catch (error) {
      if (error.message.includes('Maximum session limit')) {
        throw error; // Re-throw for block strategy
      }
      logger.error('Error handling session limit', { 
        error: error.message, 
        userId: user._id 
      });
    }
  },
  
  /**
   * Detect device name from user agent string
   * @param {string} userAgent - Browser/device user agent
   * @returns {string} Friendly device name
   */
  determineDeviceName: (userAgent = '') => {
    userAgent = userAgent.toLowerCase();
    let device = 'Unknown device';
    
    if (!userAgent) {
      return device;
    }
    
    // Simple detection logic - can be expanded
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      device = 'iOS Device';
    } else if (userAgent.includes('android')) {
      device = 'Android Device';
    } else if (userAgent.includes('windows')) {
      device = 'Windows Computer';
    } else if (userAgent.includes('mac')) {
      device = 'Mac Computer';
    } else if (userAgent.includes('linux')) {
      device = 'Linux Computer';
    }
    
    // Browser detection
    if (userAgent.includes('chrome')) {
      device += ' - Chrome';
    } else if (userAgent.includes('firefox')) {
      device += ' - Firefox';
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      device += ' - Safari';
    } else if (userAgent.includes('edge') || userAgent.includes('edg')) {
      device += ' - Edge';
    }
    
    return device;
  },

  /**
   * Get all active sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Active sessions
   */
  getUserActiveSessions: async (userId) => {
    try {
      return await Session.getActiveSessions(userId);
    } catch (error) {
      logger.error('Failed to get user active sessions', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  },

  /**
   * Revoke a specific session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Revoked session
   */
  revokeSession: async (sessionId) => {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Add token to blacklist
      await TokenBlacklist.blacklist(session.tokenId, session.expiresAt);
      
      // Mark session as revoked
      session.isRevoked = true;
      await session.save();
      
      logger.info(`Session revoked`, { 
        sessionId, 
        userId: session.userId, 
        tokenId: session.tokenId 
      });
      
      return session;
    } catch (error) {
      logger.error('Failed to revoke session', { 
        error: error.message, 
        sessionId 
      });
      throw error;
    }
  },

  /**
   * Revoke all sessions for a user except the current one
   * @param {string} userId - User ID
   * @param {string} currentSessionId - Current session ID to keep
   * @returns {Promise<Object>} Result with revoked count
   */
  revokeAllOtherSessions: async (userId, currentSessionId) => {
    try {
      // First get the current session to keep its token ID
      const currentSession = await Session.findById(currentSessionId);
      
      if (!currentSession || currentSession.userId.toString() !== userId.toString()) {
        throw new Error('Invalid current session');
      }
      
      // Get all active sessions except current one
      const otherSessions = await Session.find({
        userId,
        _id: { $ne: currentSessionId },
        isRevoked: false,
        expiresAt: { $gt: new Date() }
      });
      
      // Add all tokens to blacklist
      const blacklistPromises = otherSessions.map(session => 
        TokenBlacklist.blacklist(session.tokenId, session.expiresAt)
      );
      await Promise.all(blacklistPromises);
      
      // Mark all sessions as revoked
      const result = await Session.revokeAllExcept(userId, currentSession.tokenId);
      
      logger.info(`Revoked all other sessions for user`, { 
        userId, 
        currentSessionId,
        count: result.modifiedCount || otherSessions.length 
      });
      
      return { 
        success: true, 
        revokedCount: result.modifiedCount || otherSessions.length 
      };
    } catch (error) {
      logger.error('Failed to revoke other sessions', { 
        error: error.message, 
        userId,
        currentSessionId 
      });
      throw error;
    }
  },

  /**
   * Validate a session (used by auth middleware)
   * @param {string} tokenId - Token ID from the JWT
   * @returns {Promise<boolean>} Whether session is valid
   */
  validateSession: async (tokenId) => {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await TokenBlacklist.isBlacklisted(tokenId);
      if (isBlacklisted) {
        logger.info(`Token is blacklisted`, { tokenId });
        return false;
      }
      
      // Get and update session
      const session = await Session.findByTokenId(tokenId);
      
      if (!session) {
        logger.info(`Session not found for token`, { tokenId });
        return false;
      }
      
      // Update last active timestamp
      session.lastActive = Date.now();
      await session.save();
      
      return true;
    } catch (error) {
      logger.error('Failed to validate session', { 
        error: error.message, 
        tokenId 
      });
      return false;
    }
  },

  /**
   * Update the device name for a session
   * @param {string} sessionId - Session ID
   * @param {string} deviceName - New device name
   * @returns {Promise<Object>} Updated session
   */
  updateSessionDeviceName: async (sessionId, deviceName) => {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      session.deviceName = deviceName;
      await session.save();
      
      logger.info(`Updated session device name`, {
        sessionId,
        userId: session.userId,
        deviceName
      });
      
      return session;
    } catch (error) {
      logger.error('Failed to update session device name', { 
        error: error.message, 
        sessionId 
      });
      throw error;
    }
  },

  /**
   * Cleanup routine for expired sessions and blacklisted tokens
   * To be run periodically via cron job
   */
  cleanupExpiredSessions: async () => {
    try {
      logger.info('Starting session cleanup...');
      
      // Clean up expired sessions
      const sessionsResult = await Session.cleanupExpiredSessions();
      
      // Clean up expired blacklisted tokens
      const tokensResult = await TokenBlacklist.cleanupExpiredTokens();
      
      logger.info('Session cleanup complete', {
        sessionsRemoved: sessionsResult.deletedCount || 0,
        blacklistedTokensRemoved: tokensResult.deletedCount || 0
      });
      
      return {
        success: true,
        sessionsRemoved: sessionsResult.deletedCount || 0,
        blacklistedTokensRemoved: tokensResult.deletedCount || 0
      };
    } catch (error) {
      logger.error('Session cleanup failed', { error: error.message });
      throw error;
    }
  },

  /**
   * Update user's session management preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Session preferences
   * @returns {Promise<Object>} Updated user
   */
  updateSessionPreferences: async (userId, preferences) => {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update max concurrent sessions if provided
      if (preferences.maxConcurrentSessions !== undefined) {
        user.maxConcurrentSessions = Math.min(
          Math.max(1, preferences.maxConcurrentSessions), // Between 1 and max
          10 // Hard upper limit
        );
      }
      
      // Update session strategy if provided
      if (preferences.sessionStrategy !== undefined) {
        const validStrategies = ['oldest', 'least-active', 'notify', 'block'];
        if (validStrategies.includes(preferences.sessionStrategy)) {
          user.sessionStrategy = preferences.sessionStrategy;
        }
      }
      
      await user.save();
      
      logger.info(`Updated session preferences for user`, { 
        userId,
        maxSessions: user.maxConcurrentSessions,
        strategy: user.sessionStrategy
      });
      
      return {
        success: true,
        maxConcurrentSessions: user.maxConcurrentSessions,
        sessionStrategy: user.sessionStrategy
      };
    } catch (error) {
      logger.error('Failed to update session preferences', { 
        error: error.message, 
        userId 
      });
      throw error;
    }
  }
};

module.exports = sessionService;
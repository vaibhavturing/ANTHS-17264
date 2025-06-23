/**
 * Session Middleware for Stateless Architecture
 * Manages user sessions using Redis for cross-instance state sharing
 * Enables stateless server instances that can be scaled horizontally
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const redisClients = require('../config/redis.config');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// Get Redis client for sessions
const sessionClient = redisClients.getSessionClient();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'healthcare-app-jwt-secret';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';
const TOKEN_TYPE = 'Bearer';

/**
 * Session middleware for stateless architecture
 */
const sessionMiddleware = {
  /**
   * Create a new session
   * @param {Object} user - User object
   * @param {Object} metadata - Additional session metadata
   * @returns {Promise<Object>} Session information including tokens
   */
  createSession: async (user, metadata = {}) => {
    try {
      // Generate session ID
      const sessionId = uuidv4();
      
      // Prepare payload for token
      const payload = {
        sub: user._id.toString(),
        sessionId: sessionId,
        roles: user.roles || [],
        type: 'access'
      };
      
      // Generate access token
      const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      
      // Generate refresh token with longer expiry
      const refreshToken = jwt.sign(
        { ...payload, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Calculate expiry time
      const expirySeconds = parseInt(JWT_EXPIRY) || 3600;
      
      // Prepare session data
      const sessionData = {
        userId: user._id.toString(),
        username: user.username || user.email,
        email: user.email,
        roles: user.roles || [],
        permissions: user.permissions || [],
        sessionId: sessionId,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
        lastActivity: new Date().toISOString(),
        metadata: metadata
      };
      
      // Store session in Redis with expiry (add buffer time to session storage)
      await sessionClient.setex(
        `session:${sessionId}`,
        expirySeconds + 300, // Add 5 minutes buffer
        JSON.stringify(sessionData)
      );
      
      // Store refresh token reference with longer expiry
      await sessionClient.setex(
        `refresh:${sessionId}`,
        7 * 24 * 3600, // 7 days
        refreshToken
      );
      
      return {
        accessToken,
        refreshToken,
        tokenType: TOKEN_TYPE,
        expiresIn: expirySeconds,
        sessionId
      };
    } catch (error) {
      logger.error('Error creating session:', error);
      throw new AppError('Failed to create session', 500);
    }
  },
  
  /**
   * Validate a session using the access token
   * @param {string} token - JWT access token
   * @returns {Promise<Object>} Session data if valid
   */
  validateSession: async (token) => {
    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Ensure it's an access token
      if (decoded.type !== 'access') {
        throw new AppError('Invalid token type', 401);
      }
      
      // Get session from Redis
      const sessionKey = `session:${decoded.sessionId}`;
      const sessionData = await sessionClient.get(sessionKey);
      
      // Check if session exists
      if (!sessionData) {
        throw new AppError('Session expired or invalid', 401);
      }
      
      // Parse session data
      const session = JSON.parse(sessionData);
      
      // Update last activity
      session.lastActivity = new Date().toISOString();
      
      // Update session in Redis (without changing expiry)
      const ttl = await sessionClient.ttl(sessionKey);
      if (ttl > 0) {
        await sessionClient.setex(
          sessionKey,
          ttl,
          JSON.stringify(session)
        );
      }
      
      return session;
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new AppError('Invalid or expired token', 401);
      }
      
      logger.error('Error validating session:', error);
      throw error;
    }
  },
  
  /**
   * Refresh a session using a refresh token
   * @param {string} refreshToken - JWT refresh token
   * @returns {Promise<Object>} New session information
   */
  refreshSession: async (refreshToken) => {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      
      // Ensure it's a refresh token
      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401);
      }
      
      const { sessionId, sub } = decoded;
      
      // Check if refresh token matches stored one
      const storedToken = await sessionClient.get(`refresh:${sessionId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new AppError('Invalid refresh token', 401);
      }
      
      // Get session data
      const sessionData = await sessionClient.get(`session:${sessionId}`);
      if (!sessionData) {
        throw new AppError('Session not found', 401);
      }
      
      // Parse session
      const session = JSON.parse(sessionData);
      
      // Create new payload
      const payload = {
        sub,
        sessionId,
        roles: session.roles || [],
        type: 'access'
      };
      
      // Generate new access token
      const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
      
      // Calculate expiry time
      const expirySeconds = parseInt(JWT_EXPIRY) || 3600;
      
      // Update session
      session.lastActivity = new Date().toISOString();
      session.expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
      
      // Store updated session
      await sessionClient.setex(
        `session:${sessionId}`,
        expirySeconds + 300, // Add 5 minutes buffer
        JSON.stringify(session)
      );
      
      return {
        accessToken,
        refreshToken, // Keep same refresh token
        tokenType: TOKEN_TYPE,
        expiresIn: expirySeconds,
        sessionId
      };
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new AppError('Invalid or expired refresh token', 401);
      }
      
      logger.error('Error refreshing session:', error);
      throw error;
    }
  },
  
  /**
   * End a user session
   * @param {string} sessionId - Session ID to end
   * @returns {Promise<boolean>} Success indicator
   */
  endSession: async (sessionId) => {
    try {
      // Delete session and refresh token from Redis
      await Promise.all([
        sessionClient.del(`session:${sessionId}`),
        sessionClient.del(`refresh:${sessionId}`)
      ]);
      
      return true;
    } catch (error) {
      logger.error('Error ending session:', error);
      throw new AppError('Failed to end session', 500);
    }
  },
  
  /**
   * End all sessions for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of sessions ended
   */
  endAllUserSessions: async (userId) => {
    try {
      // Scan for all user sessions
      const userSessions = [];
      let cursor = '0';
      
      do {
        // Scan Redis for session keys
        const [nextCursor, keys] = await sessionClient.scan(
          cursor, 
          'MATCH', 
          'session:*'
        );
        
        cursor = nextCursor;
        
        // Get session data for each key
        if (keys.length > 0) {
          const sessionValues = await sessionClient.mget(keys);
          
          for (let i = 0; i < keys.length; i++) {
            if (sessionValues[i]) {
              try {
                const session = JSON.parse(sessionValues[i]);
                
                // Check if session belongs to user
                if (session.userId === userId) {
                  userSessions.push({
                    key: keys[i],
                    sessionId: session.sessionId
                  });
                }
              } catch (e) {
                // Skip invalid session data
                logger.warn(`Invalid session data format: ${keys[i]}`);
              }
            }
          }
        }
      } while (cursor !== '0');
      
      // Delete all sessions and refresh tokens
      if (userSessions.length > 0) {
        const sessionKeys = userSessions.map(s => s.key);
        const refreshKeys = userSessions.map(s => `refresh:${s.sessionId}`);
        
        await Promise.all([
          sessionClient.del(sessionKeys),
          sessionClient.del(refreshKeys)
        ]);
      }
      
      return userSessions.length;
    } catch (error) {
      logger.error('Error ending all user sessions:', error);
      throw new AppError('Failed to end user sessions', 500);
    }
  },
  
  /**
   * Get active session count
   * @returns {Promise<number>} Number of active sessions
   */
  getActiveSessionCount: async () => {
    try {
      const keys = await sessionClient.keys('session:*');
      return keys.length;
    } catch (error) {
      logger.error('Error counting active sessions:', error);
      return 0;
    }
  }
};

module.exports = sessionMiddleware;
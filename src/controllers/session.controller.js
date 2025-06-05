// File: src/controllers/session.controller.js
// New controller for session management endpoints

const sessionService = require('../services/session.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');

/**
 * Controller for session management endpoints
 */
const sessionController = {
  /**
   * Get all active sessions for the current user
   * @route GET /api/sessions
   * @access Private
   */
  getActiveSessions: asyncHandler(async (req, res) => {
    const sessions = await sessionService.getUserActiveSessions(req.user._id);
    
    // Mark the current session
    const sessionsWithCurrent = sessions.map(session => {
      const isCurrentSession = session.tokenId === req.tokenId;
      return {
        _id: session._id,
        deviceName: session.deviceName,
        ipAddress: session.ipAddress,
        location: session.location,
        lastActive: session.lastActive,
        createdAt: session.createdAt,
        isCurrentSession
      };
    });
    
    logger.info(`Retrieved active sessions for user`, { 
      userId: req.user._id,
      count: sessions.length 
    });
    
    return ResponseUtil.success(res, { 
      sessions: sessionsWithCurrent 
    });
  }),

  /**
   * Revoke a specific session
   * @route DELETE /api/sessions/:id
   * @access Private
   */
  revokeSession: asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Get session to verify ownership
    const sessions = await sessionService.getUserActiveSessions(req.user._id);
    const targetSession = sessions.find(s => s._id.toString() === id);
    
    if (!targetSession) {
      return ResponseUtil.error(res, 'Session not found or already revoked', 404, 'NOT_FOUND');
    }
    
    // Check if trying to revoke current session
    if (targetSession.tokenId === req.tokenId) {
      return ResponseUtil.error(
        res, 
        'Cannot revoke your current session. Use logout instead.', 
        400, 
        'BAD_REQUEST'
      );
    }
    
    await sessionService.revokeSession(id);
    
    logger.info(`Session revoked for user`, { 
      userId: req.user._id, 
      sessionId: id 
    });
    
    return ResponseUtil.success(res, { 
      message: 'Session successfully revoked' 
    });
  }),

  /**
   * Revoke all other sessions except the current one
   * @route DELETE /api/sessions
   * @access Private
   */
  revokeAllOtherSessions: asyncHandler(async (req, res) => {
    // Get current session ID from active sessions
    const sessions = await sessionService.getUserActiveSessions(req.user._id);
    const currentSession = sessions.find(s => s.tokenId === req.tokenId);
    
    if (!currentSession) {
      return ResponseUtil.error(
        res, 
        'Current session not found', 
        500, 
        'INTERNAL_SERVER_ERROR'
      );
    }
    
    const result = await sessionService.revokeAllOtherSessions(
      req.user._id, 
      currentSession._id
    );
    
    logger.info(`All other sessions revoked for user`, { 
      userId: req.user._id, 
      count: result.revokedCount 
    });
    
    return ResponseUtil.success(res, { 
      message: `Successfully revoked ${result.revokedCount} sessions` 
    });
  }),

  /**
   * Update device name for a session
   * @route PATCH /api/sessions/:id
   * @access Private
   */
  updateSessionName: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { deviceName } = req.body;
    
    if (!deviceName || deviceName.trim() === '') {
      return ResponseUtil.error(
        res, 
        'Device name is required', 
        400, 
        'VALIDATION_ERROR'
      );
    }
    
    // Get session to verify ownership
    const sessions = await sessionService.getUserActiveSessions(req.user._id);
    const targetSession = sessions.find(s => s._id.toString() === id);
    
    if (!targetSession) {
      return ResponseUtil.error(
        res, 
        'Session not found or already revoked', 
        404, 
        'NOT_FOUND'
      );
    }
    
    const updatedSession = await sessionService.updateSessionDeviceName(
      id, 
      deviceName.trim()
    );
    
    logger.info(`Session device name updated`, { 
      userId: req.user._id, 
      sessionId: id,
      deviceName: deviceName.trim()
    });
    
    return ResponseUtil.success(res, { 
      message: 'Device name updated successfully',
      session: {
        _id: updatedSession._id,
        deviceName: updatedSession.deviceName,
        lastActive: updatedSession.lastActive
      } 
    });
  }),

  /**
   * Get user's session preferences
   * @route GET /api/sessions/preferences
   * @access Private
   */
  getSessionPreferences: asyncHandler(async (req, res) => {
    return ResponseUtil.success(res, {
      preferences: {
        maxConcurrentSessions: req.user.maxConcurrentSessions,
        sessionStrategy: req.user.sessionStrategy
      }
    });
  }),

  /**
   * Update user's session preferences
   * @route PUT /api/sessions/preferences
   * @access Private
   */
  updateSessionPreferences: asyncHandler(async (req, res) => {
    const { maxConcurrentSessions, sessionStrategy } = req.body;
    
    const result = await sessionService.updateSessionPreferences(
      req.user._id, 
      { maxConcurrentSessions, sessionStrategy }
    );
    
    logger.info(`Session preferences updated`, { 
      userId: req.user._id,
      maxSessions: result.maxConcurrentSessions,
      strategy: result.sessionStrategy 
    });
    
    return ResponseUtil.success(res, { 
      message: 'Session preferences updated successfully',
      preferences: {
        maxConcurrentSessions: result.maxConcurrentSessions,
        sessionStrategy: result.sessionStrategy
      }
    });
  })
};

module.exports = sessionController;
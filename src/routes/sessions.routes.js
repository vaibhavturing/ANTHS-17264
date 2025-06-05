// File: src/routes/sessions.routes.js
// New routes for session management

const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/session.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validateMiddleware = require('../middleware/validate.middleware');
const sessionValidator = require('../validators/session.validator');

// All routes require authentication
router.use(authMiddleware.authenticate);

/**
 * @route GET /api/sessions
 * @description Get all active sessions for current user
 * @access Private
 */
router.get('/', sessionController.getActiveSessions);

/**
 * @route GET /api/sessions/preferences
 * @description Get user's session preferences
 * @access Private
 */
router.get('/preferences', sessionController.getSessionPreferences);

/**
 * @route PUT /api/sessions/preferences
 * @description Update user's session preferences
 * @access Private
 */
router.put(
  '/preferences',
  validateMiddleware(sessionValidator.updatePreferencesSchema),
  sessionController.updateSessionPreferences
);

/**
 * @route DELETE /api/sessions/:id
 * @description Revoke a specific session
 * @access Private
 */
router.delete('/:id', sessionController.revokeSession);

/**
 * @route DELETE /api/sessions
 * @description Revoke all other sessions except current one
 * @access Private
 */
router.delete('/', sessionController.revokeAllOtherSessions);

/**
 * @route PATCH /api/sessions/:id
 * @description Update device name for a session
 * @access Private
 */
router.patch(
  '/:id',
  validateMiddleware(sessionValidator.updateSessionNameSchema),
  sessionController.updateSessionName
);

module.exports = router;
const express = require('express');
const waitlistController = require('../controllers/waitlist.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validation.middleware');
const waitlistValidator = require('../validators/waitlist.validator');

const router = express.Router();

// Base routes with authentication
router.use(authMiddleware.authenticate);

// Add to waitlist
router.post(
  '/',
  validate(waitlistValidator.addToWaitlist),
  waitlistController.addToWaitlist
);

// Get waitlist entries with optional filtering
router.get(
  '/',
  validate(waitlistValidator.getWaitlist),
  waitlistController.getWaitlist
);

// Update a waitlist entry
router.put(
  '/:id',
  validate(waitlistValidator.updateWaitlistEntry),
  waitlistController.updateWaitlistEntry
);

// Remove from waitlist
router.delete(
  '/:id',
  waitlistController.removeFromWaitlist
);

// NEW: Response to slot offer endpoint (no authentication required - accessed via email/SMS link)
router.put(
  '/:id/respond',
  validate(waitlistValidator.respondToSlotOffer),
  waitlistController.respondToSlotOffer
);

// Check availability for a waitlist entry
router.get(
  '/:id/check-availability',
  waitlistController.checkAvailability
);

// Handle expired hold (system endpoint, requires admin)
router.post(
  '/handle-expired-hold',
  authMiddleware.authenticate,
  authMiddleware.authorize(['admin', 'system']),
  validate(waitlistValidator.handleExpiredHold),
  waitlistController.handleExpiredHold
);

module.exports = router;
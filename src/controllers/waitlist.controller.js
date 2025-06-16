const waitlistService = require('../services/waitlist.service');
const notificationService = require('../services/notification.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { WaitlistError } = require('../utils/errors');
const logger = require('../utils/logger');

const waitlistController = {
  /**
   * Add a patient to the waitlist
   * @route POST /api/waitlist
   */
  addToWaitlist: asyncHandler(async (req, res) => {
    try {
      const waitlistEntry = await waitlistService.addToWaitlist(req.body);
      
      return ResponseUtil.success(res, {
        message: 'Added to waitlist successfully',
        waitlistEntry
      }, 201);
    } catch (error) {
      logger.error('Failed to add to waitlist', {
        error: error.message,
        body: req.body
      });
      
      if (error instanceof WaitlistError) {
        return ResponseUtil.error(
          res,
          error.message,
          400,
          error.code
        );
      }
      
      return ResponseUtil.error(
        res,
        'Failed to add to waitlist',
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Get waitlist entries with optional filtering
   * @route GET /api/waitlist
   */
  getWaitlist: asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 10, ...filters } = req.query;
      
      const result = await waitlistService.getWaitlist(
        filters,
        parseInt(page),
        parseInt(limit)
      );
      
      return ResponseUtil.success(res, result);
    } catch (error) {
      logger.error('Failed to get waitlist', {
        error: error.message,
        query: req.query
      });
      
      return ResponseUtil.error(
        res,
        'Failed to retrieve waitlist',
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Update a waitlist entry
   * @route PUT /api/waitlist/:id
   */
  updateWaitlistEntry: asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const updatedEntry = await waitlistService.updateWaitlistEntry(id, req.body);
      
      return ResponseUtil.success(res, {
        message: 'Waitlist entry updated successfully',
        waitlistEntry: updatedEntry
      });
    } catch (error) {
      logger.error('Failed to update waitlist entry', {
        error: error.message,
        id: req.params.id,
        body: req.body
      });
      
      if (error instanceof WaitlistError) {
        return ResponseUtil.error(
          res,
          error.message,
          400,
          error.code
        );
      }
      
      return ResponseUtil.error(
        res,
        'Failed to update waitlist entry',
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Remove a patient from the waitlist
   * @route DELETE /api/waitlist/:id
   */
  removeFromWaitlist: asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      await waitlistService.removeFromWaitlist(id);
      
      return ResponseUtil.success(res, {
        message: 'Removed from waitlist successfully'
      });
    } catch (error) {
      logger.error('Failed to remove from waitlist', {
        error: error.message,
        id: req.params.id
      });
      
      if (error instanceof WaitlistError) {
        return ResponseUtil.error(
          res,
          error.message,
          400,
          error.code
        );
      }
      
      return ResponseUtil.error(
        res,
        'Failed to remove from waitlist',
        500,
        'SERVER_ERROR'
      );
    }
  }),

  /**
   * Handle patient response to a waitlist slot offer
   * @route PUT /api/waitlist/:id/respond
   */
  respondToSlotOffer: asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const { slotId, response } = req.body;
      
      if (!['accept', 'decline'].includes(response)) {
        return ResponseUtil.error(
          res,
          'Invalid response. Must be "accept" or "decline"',
          400,
          'INVALID_RESPONSE'
        );
      }
      
      const result = await notificationService.processWaitlistResponse(id, slotId, response);
      
      return ResponseUtil.success(res, {
        message: result.message || 'Response processed successfully',
        appointment: result.appointment || null
      });
    } catch (error) {
      logger.error('Failed to process waitlist response', {
        error: error.message,
        id: req.params.id,
        body: req.body
      });
      
      return ResponseUtil.error(
        res,
        error.message || 'Failed to process response',
        400,
        'RESPONSE_PROCESSING_FAILED'
      );
    }
  }),

  /**
   * Check if any slots are available for a waitlist entry
   * @route GET /api/waitlist/:id/check-availability
   */
  checkAvailability: asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      const result = await waitlistService.checkAvailabilityForWaitlist(id);
      
      return ResponseUtil.success(res, result);
    } catch (error) {
      logger.error('Failed to check availability for waitlist', {
        error: error.message,
        id: req.params.id
      });
      
      return ResponseUtil.error(
        res,
        error.message || 'Failed to check availability',
        400,
        'AVAILABILITY_CHECK_FAILED'
      );
    }
  }),
  
  /**
   * Handle an expired slot hold (system endpoint)
   * @route POST /api/waitlist/handle-expired-hold
   */
  handleExpiredHold: asyncHandler(async (req, res) => {
    try {
      const { waitlistEntryId } = req.body;
      
      if (!waitlistEntryId) {
        return ResponseUtil.error(
          res,
          'Waitlist entry ID is required',
          400,
          'MISSING_WAITLIST_ID'
        );
      }
      
      const result = await notificationService.handleExpiredSlotHold(waitlistEntryId);
      
      return ResponseUtil.success(res, {
        message: result.message || 'Expired hold processed successfully'
      });
    } catch (error) {
      logger.error('Failed to handle expired hold', {
        error: error.message,
        body: req.body
      });
      
      return ResponseUtil.error(
        res,
        error.message || 'Failed to process expired hold',
        400,
        'EXPIRED_HOLD_PROCESSING_FAILED'
      );
    }
  })
};

module.exports = waitlistController;
// src/controllers/appointment-reminder.controller.js
const appointmentReminderService = require('../services/appointment-reminder.service');
const Appointment = require('../models/appointment.model');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Controller for appointment reminder operations
 */
const appointmentReminderController = {
  /**
   * Schedule reminder for a single appointment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  scheduleReminder: async (req, res, next) => {
    try {
      const { appointmentId } = req.params;
      const { reminderDate } = req.body;
      
      // Validate appointment ID
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        throw new BadRequestError('Invalid appointment ID format');
      }
      
      // Validate appointment exists
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }
      
      // Convert reminderDate if provided
      let reminderTime = null;
      if (reminderDate) {
        reminderTime = new Date(reminderDate);
        if (isNaN(reminderTime)) {
          throw new BadRequestError('Invalid reminderDate format');
        }
      }
      
      // Schedule the reminder
      const job = await appointmentReminderService.scheduleAppointmentReminder(appointmentId, reminderTime);
      
      if (!job) {
        return res.status(400).json({
          success: false,
          message: 'Cannot schedule reminder in the past'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Appointment reminder scheduled successfully',
        data: {
          jobId: job.id,
          appointmentId,
          scheduledFor: new Date(Date.now() + job.opts.delay).toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Schedule batch reminders for appointments
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  scheduleBatchReminders: async (req, res, next) => {
    try {
      // This is a potentially slow operation that we're offloading to the queue
      const { daysAhead = 1, limit = 100 } = req.body;
      
      // Validate input
      if (daysAhead < 0 || daysAhead > 30) {
        throw new BadRequestError('daysAhead must be between 0 and 30');
      }
      
      if (limit < 1 || limit > 1000) {
        throw new BadRequestError('limit must be between 1 and 1000');
      }
      
      // Schedule the batch job
      const job = await appointmentReminderService.scheduleBatchReminders(daysAhead, limit);
      
      res.status(202).json({
        success: true,
        message: `Batch reminder job queued successfully for appointments ${daysAhead} day(s) ahead`,
        data: {
          jobId: job.id,
          daysAhead,
          limit
        }
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get reminder queue status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getReminderQueueStatus: async (req, res, next) => {
    try {
      const status = await appointmentReminderService.getReminderQueueStatus();
      
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Clean up old reminder jobs
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  cleanupReminderJobs: async (req, res, next) => {
    try {
      const { olderThan } = req.body;
      
      // Default to 7 days if not specified
      const olderThanMs = olderThan ? parseInt(olderThan) * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      
      const result = await appointmentReminderService.cleanupOldReminderJobs(olderThanMs);
      
      res.status(200).json({
        success: true,
        message: 'Old reminder jobs cleaned up successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = appointmentReminderController;
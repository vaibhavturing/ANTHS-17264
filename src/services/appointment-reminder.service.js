// src/services/appointment-reminder.service.js
const queueService = require('./queue.service');
const logger = require('../utils/logger');
const queueConfig = require('../config/queue.config');
const Appointment = require('../models/appointment.model');

/**
 * Service for managing appointment reminders
 */
const appointmentReminderService = {
  /**
   * Schedule a reminder for a single appointment
   * @param {string} appointmentId - Appointment ID
   * @param {Date|number} scheduledTime - When to send the reminder
   * @returns {Promise<Object>} The scheduled job
   */
  scheduleAppointmentReminder: async (appointmentId, scheduledTime) => {
    try {
      logger.info(`Scheduling reminder for appointment ${appointmentId}`);
      
      // Calculate when to send the reminder (default: 24 hours before appointment)
      let reminderTime;
      
      if (scheduledTime) {
        reminderTime = scheduledTime;
      } else {
        // Get appointment details to calculate default reminder time
        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
          throw new Error(`Appointment ${appointmentId} not found`);
        }
        
        // Schedule reminder for 24 hours before the appointment
        reminderTime = new Date(appointment.scheduledTime);
        reminderTime.setDate(reminderTime.getDate() - 1);
      }
      
      // Don't schedule reminders in the past
      if (reminderTime < new Date()) {
        logger.warn(`Attempted to schedule reminder for appointment ${appointmentId} in the past`);
        return null;
      }
      
      // Add job to the queue
      const job = await queueService.scheduleJob(
        'APPOINTMENT_REMINDER',
        'single-reminder',
        { appointmentId },
        reminderTime
      );
      
      logger.info(`Scheduled reminder for appointment ${appointmentId} at ${reminderTime.toISOString()}, job ID: ${job.id}`);
      
      return job;
    } catch (error) {
      logger.error(`Error scheduling reminder for appointment ${appointmentId}:`, error);
      throw error;
    }
  },
  
  /**
   * Schedule reminders for all appointments on a specific date
   * @param {number} daysAhead - Number of days ahead to schedule reminders for
   * @param {number} limit - Maximum number of reminders to process
   * @returns {Promise<Object>} The scheduled job
   */
  scheduleBatchReminders: async (daysAhead = 1, limit = 100) => {
    try {
      logger.info(`Scheduling batch reminders for appointments ${daysAhead} day(s) ahead`);
      
      // Add job to the queue
      const job = await queueService.addJob(
        'APPOINTMENT_REMINDER',
        'batch-reminders',
        { days: daysAhead, limit }
      );
      
      logger.info(`Scheduled batch reminders for ${daysAhead} day(s) ahead, job ID: ${job.id}`);
      
      return job;
    } catch (error) {
      logger.error(`Error scheduling batch reminders:`, error);
      throw error;
    }
  },
  
  /**
   * Get status of appointment reminder jobs
   * @returns {Promise<Object>} Queue status
   */
  getReminderQueueStatus: async () => {
    try {
      const queue = queueService.getQueue('APPOINTMENT_REMINDER');
      const counts = await queue.getJobCounts();
      
      return {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed
      };
    } catch (error) {
      logger.error('Error getting reminder queue status:', error);
      throw error;
    }
  },
  
  /**
   * Clean up old reminder jobs
   * @param {number} olderThan - Age in milliseconds (default: 7 days)
   * @returns {Promise<Object>} Number of jobs removed
   */
  cleanupOldReminderJobs: async (olderThan = 7 * 24 * 60 * 60 * 1000) => {
    try {
      return await queueService.cleanOldJobs('APPOINTMENT_REMINDER', olderThan);
    } catch (error) {
      logger.error('Error cleaning old reminder jobs:', error);
      throw error;
    }
  }
};

module.exports = appointmentReminderService;
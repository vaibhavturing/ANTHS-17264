// src/services/scheduled-task.service.js
const cron = require('node-cron');
const logger = require('../utils/logger');
const appointmentReminderService = require('./appointment-reminder.service');
const reportService = require('./report.service');
const queueService = require('./queue.service');

/**
 * Service for managing scheduled tasks
 */
const scheduledTaskService = {
  /**
   * Start all scheduled tasks
   */
  startAllTasks: () => {
    logger.info('Starting all scheduled tasks');
    
    // Schedule daily appointment reminders at 8:00 AM every day
    cron.schedule('0 8 * * *', async () => {
      try {
        logger.info('Running scheduled task: Daily appointment reminders');
        await appointmentReminderService.scheduleBatchReminders(1, 500);
      } catch (error) {
        logger.error('Error in daily appointment reminders task:', error);
      }
    });
    
    // Schedule weekly patient statistics report every Monday at 1:00 AM
    cron.schedule('0 1 * * 1', async () => {
      try {
        logger.info('Running scheduled task: Weekly patient statistics report');
        await reportService.generatePatientStatisticsReport({
          emailTo: process.env.ADMIN_EMAIL || 'admin@example.com'
        });
      } catch (error) {
        logger.error('Error in weekly patient statistics report task:', error);
      }
    });
    
    // Schedule monthly appointment statistics report on the 1st of each month at 2:00 AM
    cron.schedule('0 2 1 * *', async () => {
      try {
        logger.info('Running scheduled task: Monthly appointment statistics report');
        
        // Get date range for the previous month
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        
        await reportService.generateAppointmentStatisticsReport({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          emailTo: process.env.ADMIN_EMAIL || 'admin@example.com'
        });
      } catch (error) {
        logger.error('Error in monthly appointment statistics report task:', error);
      }
    });
    
    // Schedule doctor workload report every Sunday at 3:00 AM
    cron.schedule('0 3 * * 0', async () => {
      try {
        logger.info('Running scheduled task: Weekly doctor workload report');
        
        // Get date range for the past week
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        
        await reportService.generateDoctorWorkloadReport({
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          emailTo: process.env.ADMIN_EMAIL || 'admin@example.com'
        });
      } catch (error) {
        logger.error('Error in weekly doctor workload report task:', error);
      }
    });
    
    // Schedule queue cleanup every day at 4:00 AM
    cron.schedule('0 4 * * *', async () => {
      try {
        logger.info('Running scheduled task: Queue cleanup');
        
        // Clean up old jobs from all queues (older than 7 days)
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        
        // Clean each queue one by one
        for (const queueKey of Object.keys(queueConfig.queues)) {
          try {
            await queueService.cleanOldJobs(queueKey, sevenDaysMs);
          } catch (cleanError) {
            logger.error(`Error cleaning queue ${queueKey}:`, cleanError);
          }
        }
      } catch (error) {
        logger.error('Error in queue cleanup task:', error);
      }
    });
    
    logger.info('All scheduled tasks started');
  },
  
  /**
   * Start a specific scheduled task immediately
   * @param {string} taskName - Name of the task to run
   * @returns {Promise<Object>} Result of the task
   */
  runTaskNow: async (taskName) => {
    logger.info(`Running scheduled task now: ${taskName}`);
    
    try {
      let result;
      
      switch (taskName) {
        case 'daily-appointment-reminders':
          result = await appointmentReminderService.scheduleBatchReminders(1, 500);
          break;
          
        case 'patient-statistics-report':
          result = await reportService.generatePatientStatisticsReport({
            emailTo: process.env.ADMIN_EMAIL || 'admin@example.com'
          });
          break;
          
        case 'appointment-statistics-report':
          // Get date range for the past month
          const now = new Date();
          const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          
          result = await reportService.generateAppointmentStatisticsReport({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            emailTo: process.env.ADMIN_EMAIL || 'admin@example.com'
          });
          break;
          
        case 'doctor-workload-report':
          // Get date range for the past week
          const today = new Date();
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          
          result = await reportService.generateDoctorWorkloadReport({
            startDate: weekAgo.toISOString(),
            endDate: today.toISOString(),
            emailTo: process.env.ADMIN_EMAIL || 'admin@example.com'
          });
          break;
          
        case 'queue-cleanup':
          // Clean up old jobs from all queues (older than 7 days)
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          result = {};
          
          // Clean each queue one by one
          for (const queueKey of Object.keys(queueConfig.queues)) {
            try {
              result[queueKey] = await queueService.cleanOldJobs(queueKey, sevenDaysMs);
            } catch (cleanError) {
              logger.error(`Error cleaning queue ${queueKey}:`, cleanError);
              result[queueKey] = { error: cleanError.message };
            }
          }
          break;
          
        default:
          throw new Error(`Unknown task name: ${taskName}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error running task ${taskName}:`, error);
      throw error;
    }
  }
};

module.exports = scheduledTaskService;
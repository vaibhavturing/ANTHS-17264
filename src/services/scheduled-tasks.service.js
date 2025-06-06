// src/services/scheduled-tasks.service.js

const communicationService = require('./communication.service');
const logger = require('../utils/logger');

/**
 * Scheduled Tasks Service
 * Handles scheduled operations like processing queued communications
 */
const scheduledTasksService = {
  /**
   * Initialize scheduled tasks
   */
  initializeScheduledTasks: () => {
    // Set up interval for processing pending communications
    setInterval(async () => {
      try {
        await scheduledTasksService.processPendingCommunications();
      } catch (error) {
        logger.error('Error in scheduled communication processing', {
          error: error.message
        });
      }
    }, 60000); // Run every minute
    
    logger.info('Scheduled tasks initialized');
  },
  
  /**
   * Process pending and scheduled communications that are due
   */
  processPendingCommunications: async () => {
    try {
      const processed = await communicationService.processScheduledCommunications();
      
      if (processed > 0) {
        logger.info(`Processed ${processed} scheduled communications`);
      }
      
      return processed;
    } catch (error) {
      logger.error('Error processing scheduled communications', {
        error: error.message
      });
      throw error;
    }
  }
};

module.exports = scheduledTasksService;
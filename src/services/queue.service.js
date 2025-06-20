// src/services/queue.service.js
const Bull = require('bull');
const logger = require('../utils/logger');
const queueConfig = require('../config/queue.config');

// Initialize queues
const queues = {};

// Set up each queue with configured options
Object.entries(queueConfig.queues).forEach(([queueKey, queueName]) => {
  queues[queueKey] = new Bull(queueName, {
    redis: queueConfig.redis,
    defaultJobOptions: queueConfig.defaultJobOptions
  });
  
  // Set up global error handler for the queue
  queues[queueKey].on('error', error => {
    logger.error(`Error in queue ${queueName}:`, error);
  });
  
  // Log failed jobs
  queues[queueKey].on('failed', (job, error) => {
    logger.error(`Job ${job.id} in queue ${queueName} failed:`, error);
  });
  
  // Log completed jobs at debug level
  queues[queueKey].on('completed', job => {
    logger.debug(`Job ${job.id} in queue ${queueName} completed successfully`);
  });
});

/**
 * Service for managing background job queues
 */
const queueService = {
  /**
   * Get a queue by its name
   * @param {string} queueKey - Queue key from queueConfig.queues
   * @returns {Bull.Queue} The Bull queue
   */
  getQueue: (queueKey) => {
    const queue = queues[queueKey];
    if (!queue) {
      throw new Error(`Queue ${queueKey} not found`);
    }
    return queue;
  },
  
  /**
   * Add a job to a queue
   * @param {string} queueKey - Queue key from queueConfig.queues
   * @param {string} jobName - Name of the job
   * @param {Object} data - Data for the job
   * @param {Object} options - Bull job options (optional)
   * @returns {Promise<Bull.Job>} The created job
   */
  addJob: async (queueKey, jobName, data, options = {}) => {
    try {
      const queue = queueService.getQueue(queueKey);
      
      const job = await queue.add(jobName, data, {
        ...queueConfig.defaultJobOptions,
        ...options
      });
      
      logger.info(`Added job ${job.id} to queue ${queue.name}: ${jobName}`);
      return job;
    } catch (error) {
      logger.error(`Error adding job to queue ${queueKey}:`, error);
      throw error;
    }
  },
  
  /**
   * Add a scheduled (delayed) job to a queue
   * @param {string} queueKey - Queue key from queueConfig.queues
   * @param {string} jobName - Name of the job
   * @param {Object} data - Data for the job
   * @param {Date|number} delay - Delay in ms or Date object
   * @param {Object} options - Bull job options (optional)
   * @returns {Promise<Bull.Job>} The created job
   */
  scheduleJob: async (queueKey, jobName, data, delay, options = {}) => {
    try {
      const queue = queueService.getQueue(queueKey);
      
      // Calculate delay in milliseconds
      let delayMs;
      if (delay instanceof Date) {
        delayMs = Math.max(0, delay.getTime() - Date.now());
      } else {
        delayMs = delay;
      }
      
      const job = await queue.add(jobName, data, {
        ...queueConfig.defaultJobOptions,
        ...options,
        delay: delayMs
      });
      
      const scheduledTime = new Date(Date.now() + delayMs);
      logger.info(`Scheduled job ${job.id} in queue ${queue.name}: ${jobName} for ${scheduledTime.toISOString()}`);
      
      return job;
    } catch (error) {
      logger.error(`Error scheduling job in queue ${queueKey}:`, error);
      throw error;
    }
  },
  
  /**
   * Get all active queues
   * @returns {Array<Bull.Queue>} List of active queues
   */
  getQueues: () => {
    return Object.values(queues);
  },
  
  /**
   * Get job counts for all queues
   * @returns {Promise<Object>} Object with job counts for each queue
   */
  getJobCounts: async () => {
    const counts = {};
    
    await Promise.all(
      Object.entries(queues).map(async ([key, queue]) => {
        counts[key] = await queue.getJobCounts();
      })
    );
    
    return counts;
  },
  
  /**
   * Clean completed and failed jobs older than the specified timestamp
   * @param {string} queueKey - Queue key from queueConfig.queues
   * @param {number} olderThan - Age of jobs to clean in milliseconds
   * @returns {Promise<Object>} Number of jobs removed
   */
  cleanOldJobs: async (queueKey, olderThan = 24 * 60 * 60 * 1000) => { // Default: 24 hours
    try {
      const queue = queueService.getQueue(queueKey);
      const result = await queue.clean(olderThan, 'completed');
      const resultFailed = await queue.clean(olderThan, 'failed');
      
      logger.info(`Cleaned ${result.length} completed and ${resultFailed.length} failed jobs from queue ${queue.name}`);
      
      return {
        completed: result.length,
        failed: resultFailed.length
      };
    } catch (error) {
      logger.error(`Error cleaning old jobs from queue ${queueKey}:`, error);
      throw error;
    }
  },
  
  /**
   * Empty a queue (remove all jobs)
   * @param {string} queueKey - Queue key from queueConfig.queues
   * @returns {Promise<void>}
   */
  emptyQueue: async (queueKey) => {
    try {
      const queue = queueService.getQueue(queueKey);
      await queue.empty();
      
      logger.info(`Emptied queue ${queue.name}`);
    } catch (error) {
      logger.error(`Error emptying queue ${queueKey}:`, error);
      throw error;
    }
  },
  
  /**
   * Pause a queue
   * @param {string} queueKey - Queue key from queueConfig.queues
   * @returns {Promise<void>}
   */
  pauseQueue: async (queueKey) => {
    try {
      const queue = queueService.getQueue(queueKey);
      await queue.pause();
      
      logger.info(`Paused queue ${queue.name}`);
    } catch (error) {
      logger.error(`Error pausing queue ${queueKey}:`, error);
      throw error;
    }
  },
  
  /**
   * Resume a paused queue
   * @param {string} queueKey - Queue key from queueConfig.queues
   * @returns {Promise<void>}
   */
  resumeQueue: async (queueKey) => {
    try {
      const queue = queueService.getQueue(queueKey);
      await queue.resume();
      
      logger.info(`Resumed queue ${queue.name}`);
    } catch (error) {
      logger.error(`Error resuming queue ${queueKey}:`, error);
      throw error;
    }
  }
};

module.exports = queueService;
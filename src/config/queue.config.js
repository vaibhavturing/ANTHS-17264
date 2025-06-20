// src/config/queue.config.js
const config = require('./config');

/**
 * Queue configuration for background job processing
 */
module.exports = {
  // Redis connection options for Bull queues
  redis: {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    db: config.REDIS_QUEUE_DB || 1, // Use a different DB than cache
    tls: config.REDIS_TLS === 'true' ? {} : null
  },
  
  // Default job options
  defaultJobOptions: {
    attempts: 3,               // Retry failed jobs up to 3 times
    backoff: {
      type: 'exponential',     // Exponential backoff strategy
      delay: 1000              // Initial delay in ms
    },
    removeOnComplete: 100,     // Keep last 100 completed jobs
    removeOnFail: 200          // Keep last 200 failed jobs
  },
  
  // Queue names
  queues: {
    EMAIL: 'email-queue',
    NOTIFICATION: 'notification-queue',
    REPORT: 'report-queue',
    APPOINTMENT_REMINDER: 'appointment-reminder-queue',
    DATA_EXPORT: 'data-export-queue',
    DATA_IMPORT: 'data-import-queue',
    SYSTEM_MAINTENANCE: 'system-maintenance-queue'
  },
  
  // Concurrency settings for each queue
  concurrency: {
    EMAIL: 5,
    NOTIFICATION: 10,
    REPORT: 2,
    APPOINTMENT_REMINDER: 5,
    DATA_EXPORT: 2,
    DATA_IMPORT: 1,
    SYSTEM_MAINTENANCE: 1
  },
  
  // Worker settings
  workers: {
    count: process.env.WORKER_COUNT || 2, // Number of worker processes to spawn
    maxJobsPerWorker: 50                  // Maximum number of jobs a worker should process
  }
};
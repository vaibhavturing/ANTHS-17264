// scripts/backup-scheduler.js

/**
 * Backup Scheduler
 * This script schedules and manages backup jobs using cron patterns
 * It should be run as a separate process using PM2 or similar
 */

const cron = require('node-cron');
const backupService = require('../src/services/backup.service');
const config = require('../src/config/backup.config');
const logger = require('../src/utils/logger');

// Initialize
logger.info('Backup scheduler starting...');

// Flag to track if a job is currently running
const runningJobs = {
  fullBackup: false,
  incrementalBackup: false,
  monthlyRetention: false,
  testRestore: false
};

// Schedule daily full backup
cron.schedule(config.schedule.daily, async () => {
  if (runningJobs.fullBackup) {
    logger.warn('Previous full backup job still running, skipping...');
    return;
  }
  
  logger.info('Starting scheduled full backup');
  runningJobs.fullBackup = true;
  
  try {
    const result = await backupService.runFullBackup();
    logger.info(`Scheduled full backup completed: ${result.backupId}`);
  } catch (error) {
    logger.error(`Scheduled full backup failed: ${error.message}`, { error });
  } finally {
    runningJobs.fullBackup = false;
  }
});

// Schedule incremental backups
cron.schedule(config.schedule.incremental, async () => {
  if (runningJobs.incrementalBackup) {
    logger.warn('Previous incremental backup job still running, skipping...');
    return;
  }
  
  logger.info('Starting scheduled incremental backup');
  runningJobs.incrementalBackup = true;
  
  try {
    // Implement incremental backup logic if needed
    // For now, we'll just run a full backup
    const result = await backupService.runFullBackup({
      type: 'incremental'
    });
    logger.info(`Scheduled incremental backup completed: ${result.backupId}`);
  } catch (error) {
    logger.error(`Scheduled incremental backup failed: ${error.message}`, { error });
  } finally {
    runningJobs.incrementalBackup = false;
  }
});

// Schedule monthly backup retention
cron.schedule(config.schedule.monthlyRetention, async () => {
  if (runningJobs.monthlyRetention) {
    logger.warn('Previous retention job still running, skipping...');
    return;
  }
  
  logger.info('Starting scheduled backup retention job');
  runningJobs.monthlyRetention = true;
  
  try {
    await backupService.applyRetentionPolicy();
    logger.info('Scheduled backup retention job completed');
  } catch (error) {
    logger.error(`Scheduled retention job failed: ${error.message}`, { error });
  } finally {
    runningJobs.monthlyRetention = false;
  }
});

// Schedule monthly restore test
cron.schedule(config.schedule.testRestore, async () => {
  if (runningJobs.testRestore) {
    logger.warn('Previous restore test job still running, skipping...');
    return;
  }
  
  logger.info('Starting scheduled restore test');
  runningJobs.testRestore = true;
  
  try {
    const result = await backupService.performTestRestore();
    logger.info(`Scheduled restore test completed: ${result.testId}, Success: ${result.success}`);
  } catch (error) {
    logger.error(`Scheduled restore test failed: ${error.message}`, { error });
  } finally {
    runningJobs.testRestore = false;
  }
});

// Handle process signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down backup scheduler');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down backup scheduler');
  process.exit(0);
});

logger.info('Backup scheduler started successfully');
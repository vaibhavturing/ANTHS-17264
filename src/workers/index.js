// src/workers/index.js
const throng = require('throng');
const logger = require('../utils/logger');
const queueConfig = require('../config/queue.config');
const mongoose = require('mongoose');
const config = require('../config/config');

// Import job processors
const emailProcessor = require('./processors/email.processor');
const notificationProcessor = require('./processors/notification.processor');
const appointmentReminderProcessor = require('./processors/appointment-reminder.processor');
const reportProcessor = require('./processors/report.processor');
const dataExportProcessor = require('./processors/data-export.processor');
const dataImportProcessor = require('./processors/data-import.processor');
const systemMaintenanceProcessor = require('./processors/system-maintenance.processor');

// Worker function that will be run in each process
function start(workerId) {
  logger.info(`Worker ${workerId} started`);
  
  // Connect to MongoDB
  mongoose.connect(config.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  }).then(() => {
    logger.info(`Worker ${workerId} connected to MongoDB`);
  }).catch(err => {
    logger.error(`Worker ${workerId} failed to connect to MongoDB:`, err);
    process.exit(1);
  });
  
  // Set up graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  function shutdown() {
    logger.info(`Worker ${workerId} shutting down...`);
    
    // Disconnect from MongoDB
    mongoose.disconnect().then(() => {
      logger.info(`Worker ${workerId} disconnected from MongoDB`);
      process.exit(0);
    }).catch(err => {
      logger.error(`Worker ${workerId} error disconnecting from MongoDB:`, err);
      process.exit(1);
    });
  }
  
  // Start the job processors
  emailProcessor.start(workerId);
  notificationProcessor.start(workerId);
  appointmentReminderProcessor.start(workerId);
  reportProcessor.start(workerId);
  dataExportProcessor.start(workerId);
  dataImportProcessor.start(workerId);
  systemMaintenanceProcessor.start(workerId);
}

// Start the workers with throng
throng({
  worker: start,
  count: queueConfig.workers.count,
  lifetime: Infinity
});
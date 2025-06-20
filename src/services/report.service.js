// src/services/report.service.js
const queueService = require('./queue.service');
const logger = require('../utils/logger');

/**
 * Service for report generation
 */
const reportService = {
  /**
   * Generate patient statistics report
   * @param {Object} options - Report options
   * @param {string} options.emailTo - Email to send report to (optional)
   * @returns {Promise<Object>} Scheduled job
   */
  generatePatientStatisticsReport: async (options = {}) => {
    try {
      logger.info('Queuing patient statistics report generation');
      
      // Add job to report queue
      const job = await queueService.addJob(
        'REPORT',
        'patient-statistics',
        {
          reportType: 'Patient Statistics',
          emailTo: options.emailTo
        }
      );
      
      logger.info(`Queued patient statistics report job ${job.id}`);
      
      return {
        jobId: job.id,
        status: 'queued'
      };
    } catch (error) {
      logger.error('Error queuing patient statistics report:', error);
      throw error;
    }
  },
  
  /**
   * Generate appointment statistics report
   * @param {Object} options - Report options
   * @param {string} options.startDate - Start date for report period (ISO string)
   * @param {string} options.endDate - End date for report period (ISO string)
   * @param {string} options.emailTo - Email to send report to (optional)
   * @returns {Promise<Object>} Scheduled job
   */
  generateAppointmentStatisticsReport: async (options = {}) => {
    try {
      logger.info('Queuing appointment statistics report generation');
      
      // Add job to report queue
      const job = await queueService.addJob(
        'REPORT',
        'appointment-statistics',
        {
          reportType: 'Appointment Statistics',
          startDate: options.startDate,
          endDate: options.endDate,
          emailTo: options.emailTo
        }
      );
      
      logger.info(`Queued appointment statistics report job ${job.id}`);
      
      return {
        jobId: job.id,
        status: 'queued'
      };
    } catch (error) {
      logger.error('Error queuing appointment statistics report:', error);
      throw error;
    }
  },
  
  /**
   * Generate doctor workload report
   * @param {Object} options - Report options
   * @param {string} options.startDate - Start date for report period (ISO string)
   * @param {string} options.endDate - End date for report period (ISO string)
   * @param {string} options.emailTo - Email to send report to (optional)
   * @returns {Promise<Object>} Scheduled job
   */
  generateDoctorWorkloadReport: async (options = {}) => {
    try {
      logger.info('Queuing doctor workload report generation');
      
      // Add job to report queue
      const job = await queueService.addJob(
        'REPORT',
        'doctor-workload',
        {
          reportType: 'Doctor Workload',
          startDate: options.startDate,
          endDate: options.endDate,
          emailTo: options.emailTo
        }
      );
      
      logger.info(`Queued doctor workload report job ${job.id}`);
      
      return {
        jobId: job.id,
        status: 'queued'
      };
    } catch (error) {
      logger.error('Error queuing doctor workload report:', error);
      throw error;
    }
  },
  
  /**
   * Get report queue status
   * @returns {Promise<Object>} Queue status
   */
  getReportQueueStatus: async () => {
    try {
      const queue = queueService.getQueue('REPORT');
      const counts = await queue.getJobCounts();
      
      return {
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed
      };
    } catch (error) {
      logger.error('Error getting report queue status:', error);
      throw error;
    }
  }
};

module.exports = reportService;
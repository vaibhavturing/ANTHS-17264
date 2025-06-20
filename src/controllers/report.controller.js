// src/controllers/report.controller.js
const reportService = require('../services/report.service');
const { BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Controller for report operations
 */
const reportController = {
  /**
   * Generate patient statistics report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  generatePatientStatisticsReport: async (req, res, next) => {
    try {
      const { emailTo } = req.body;
      
      // Queue the report generation job
      const result = await reportService.generatePatientStatisticsReport({
        emailTo
      });
      
      // Return immediate response that job has been queued
      res.status(202).json({
        success: true,
        message: 'Patient statistics report generation has been queued',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Generate appointment statistics report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  generateAppointmentStatisticsReport: async (req, res, next) => {
    try {
      const { startDate, endDate, emailTo } = req.body;
      
      // Validate dates
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start) || isNaN(end)) {
          throw new BadRequestError('Invalid date format');
        }
        
        if (end < start) {
          throw new BadRequestError('End date must be after start date');
        }
      }
      
      // Queue the report generation job
      const result = await reportService.generateAppointmentStatisticsReport({
        startDate,
        endDate,
        emailTo
      });
      
      // Return immediate response that job has been queued
      res.status(202).json({
        success: true,
        message: 'Appointment statistics report generation has been queued',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Generate doctor workload report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  generateDoctorWorkloadReport: async (req, res, next) => {
    try {
      const { startDate, endDate, emailTo } = req.body;
      
      // Validate dates
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (isNaN(start) || isNaN(end)) {
          throw new BadRequestError('Invalid date format');
        }
        
        if (end < start) {
          throw new BadRequestError('End date must be after start date');
        }
      }
      
      // Queue the report generation job
      const result = await reportService.generateDoctorWorkloadReport({
        startDate,
        endDate,
        emailTo
      });
      
      // Return immediate response that job has been queued
      res.status(202).json({
        success: true,
        message: 'Doctor workload report generation has been queued',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get report queue status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getReportQueueStatus: async (req, res, next) => {
    try {
      const status = await reportService.getReportQueueStatus();
      
      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = reportController;
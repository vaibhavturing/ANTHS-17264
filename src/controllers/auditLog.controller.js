// src/controllers/auditLog.controller.js

const AuditService = require('../services/audit.service');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Controller for audit log operations
 */
class AuditLogController {
  /**
   * Get audit logs with filtering
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Response} JSON response
   */
  async getLogs(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const {
        entityType,
        entityId,
        patientId,
        userId,
        userRole,
        action,
        successful,
        startDate,
        endDate
      } = req.query;
      
      const page = parseInt(req.query.page || 1);
      const limit = parseInt(req.query.limit || 20);
      
      const logs = await AuditService.getLogs(
        {
          entityType,
          entityId,
          patientId,
          userId,
          userRole,
          action,
          successful: successful === 'true' ? true : (successful === 'false' ? false : undefined),
          startDate,
          endDate
        },
        page,
        limit
      );
      
      return res.json({
        success: true,
        ...logs
      });
    } catch (error) {
      logger.error(`Error getting audit logs: ${error.message}`, { error });
      return res.status(500).json({
        success: false,
        message: 'An error occurred while retrieving audit logs'
      });
    }
  }
  
  /**
   * Get patient access report
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Response} JSON response
   */
  async getPatientAccessReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { patientId } = req.params;
      const { startDate, endDate } = req.query;
      
      const report = await AuditService.generatePatientAccessReport(
        patientId,
        { startDate, endDate }
      );
      
      return res.json({
        success: true,
        report
      });
    } catch (error) {
      logger.error(`Error generating patient access report: ${error.message}`, { error });
      return res.status(500).json({
        success: false,
        message: 'An error occurred while generating the patient access report'
      });
    }
  }
  
  /**
   * Get system access report
   * @param {Request} req - Express request object
   * @param {Response} res - Express response object
   * @returns {Response} JSON response
   */
  async getSystemAccessReport(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { startDate, endDate, groupBy } = req.query;
      
      const report = await AuditService.generateSystemAccessReport({
        startDate,
        endDate,
        groupBy
      });
      
      return res.json({
        success: true,
        report
      });
    } catch (error) {
      logger.error(`Error generating system access report: ${error.message}`, { error });
      return res.status(500).json({
        success: false,
        message: 'An error occurred while generating the system access report'
      });
    }
  }
}

module.exports = new AuditLogController();
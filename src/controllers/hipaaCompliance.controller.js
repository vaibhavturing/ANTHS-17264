// src/controllers/hipaaCompliance.controller.js

const hipaaComplianceService = require('../services/hipaaCompliance.service');
const logger = require('../utils/logger');
const auditService = require('../services/audit.service');

/**
 * HIPAA Compliance Controller
 * Handles API endpoints for HIPAA compliance operations
 */
class HipaaComplianceController {
  /**
   * Report a privacy/security incident
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async reportIncident(req, res) {
    try {
      // Extract incident details from request
      const incident = {
        reportedBy: req.user.id,
        incidentType: req.body.incidentType,
        description: req.body.description,
        discoveryDate: new Date(req.body.discoveryDate || Date.now()),
        affectedData: req.body.affectedData,
        affectedPatients: req.body.affectedPatients
      };
      
      // Validate required fields
      if (!incident.incidentType || !incident.description) {
        return res.status(400).json({
          success: false,
          message: 'Incident type and description are required'
        });
      }
      
      // Report incident
      const incidentRecord = await hipaaComplianceService.reportIncident(incident);
      
      // Return success
      res.status(201).json({
        success: true,
        message: 'Privacy incident reported successfully',
        incident: {
          id: incidentRecord.id,
          reportDate: incidentRecord.reportDate,
          status: incidentRecord.status
        }
      });
    } catch (error) {
      logger.error(`Error reporting privacy incident: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to report privacy incident',
        error: error.message
      });
    }
  }
  
  /**
   * Get incident details
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getIncident(req, res) {
    try {
      const incidentId = req.params.id;
      
      // Check if user has permission to access incident
      if (!req.user.roles.some(role => ['privacy-officer', 'admin', 'compliance'].includes(role))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to access incident information'
        });
      }
      
      // In a real implementation, fetch from database
      // const incident = await IncidentModel.findById(incidentId);
      
      // Mock incident data for demonstration
      const incident = {
        id: incidentId,
        reportedBy: 'user123',
        incidentType: 'unauthorized-access',
        description: 'Potential unauthorized access to patient records',
        discoveryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        reportDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'under-assessment'
      };
      
      // If no incident found
      if (!incident) {
        return res.status(404).json({
          success: false,
          message: 'Incident not found'
        });
      }
      
      // Log for audit trail
      await auditService.createSecurityAuditLog({
        action: 'privacy_incident_viewed',
        userId: req.user.id,
        resourceType: 'privacy_incident',
        resourceId: incidentId
      });
      
      // Return incident details
      res.status(200).json({
        success: true,
        incident
      });
    } catch (error) {
      logger.error(`Error getting incident details: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get incident details',
        error: error.message
      });
    }
  }
  
  /**
   * Perform breach assessment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async assessIncident(req, res) {
    try {
      const incidentId = req.params.id;
      
      // Check if user has permission to assess incidents
      if (!req.user.roles.some(role => ['privacy-officer', 'compliance'].includes(role))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to perform breach assessment'
        });
      }
      
      // Extract assessment details
      const assessment = {
        assessedBy: req.user.id,
        riskAnalysis: req.body.riskAnalysis,
        isBreachDetermined: req.body.isBreachDetermined,
        justification: req.body.justification
      };
      
      // Validate required fields
      if (assessment.isBreachDetermined === undefined || !assessment.justification) {
        return res.status(400).json({
          success: false,
          message: 'Breach determination and justification are required'
        });
      }
      
      // Perform assessment
      const updatedIncident = await hipaaComplianceService.performBreachAssessment(
        incidentId, 
        assessment
      );
      
      // Return updated incident
      res.status(200).json({
        success: true,
        message: 'Breach assessment completed',
        incident: {
          id: updatedIncident.id,
          status: updatedIncident.status,
          breachDetermination: updatedIncident.breachDetermination,
          notificationRequired: updatedIncident.notificationRequired
        }
      });
    } catch (error) {
      logger.error(`Error performing breach assessment: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to perform breach assessment',
        error: error.message
      });
    }
  }
  
  /**
   * Record breach notification to individuals
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async recordIndividualNotification(req, res) {
    try {
      const incidentId = req.params.id;
      
      // Check if user has permission
      if (!req.user.roles.some(role => ['privacy-officer', 'compliance'].includes(role))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to record breach notifications'
        });
      }
      
      // Extract notification details
      const notification = {
        sentBy: req.user.id,
        method: req.body.method,
        sentDate: req.body.sentDate ? new Date(req.body.sentDate) : new Date(),
        recipientCount: req.body.recipientCount,
        template: req.body.template
      };
      
      // Validate required fields
      if (!notification.method || !notification.recipientCount) {
        return res.status(400).json({
          success: false,
          message: 'Notification method and recipient count are required'
        });
      }
      
      // Record notification
      const result = await hipaaComplianceService.recordIndividualNotification(
        incidentId,
        notification
      );
      
      // Return success
      res.status(200).json({
        success: true,
        message: 'Individual notification recorded',
        notification: {
          incidentId: result.incidentId,
          type: result.type,
          method: result.method,
          sentDate: result.sentDate,
          recipientCount: result.recipientCount
        }
      });
    } catch (error) {
      logger.error(`Error recording individual notification: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to record individual notification',
        error: error.message
      });
    }
  }
  
  /**
   * Record breach notification to HHS/OCR
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async recordHHSNotification(req, res) {
    try {
      const incidentId = req.params.id;
      
      // Check if user has permission
      if (!req.user.roles.some(role => ['privacy-officer', 'compliance'].includes(role))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to record HHS notifications'
        });
      }
      
      // Extract notification details
      const notification = {
        submittedBy: req.user.id,
        method: req.body.method,
        sentDate: req.body.sentDate ? new Date(req.body.sentDate) : new Date(),
        trackingNumber: req.body.trackingNumber,
        confirmationReceipt: req.body.confirmationReceipt
      };
      
      // Validate required fields
      if (!notification.method || !notification.trackingNumber) {
        return res.status(400).json({
          success: false,
          message: 'Notification method and tracking number are required'
        });
      }
      
      // Record notification
      const result = await hipaaComplianceService.recordHHSNotification(
        incidentId,
        notification
      );
      
      // Return success
      res.status(200).json({
        success: true,
        message: 'HHS notification recorded',
        notification: {
          incidentId: result.incidentId,
          type: result.type,
          method: result.method,
          sentDate: result.sentDate,
          trackingNumber: result.trackingNumber
        }
      });
    } catch (error) {
      logger.error(`Error recording HHS notification: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to record HHS notification',
        error: error.message
      });
    }
  }
  
  /**
   * Generate HIPAA compliance report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async generateComplianceReport(req, res) {
    try {
      // Check if user has permission
      if (!req.user.roles.some(role => ['admin', 'compliance', 'privacy-officer'].includes(role))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to generate compliance reports'
        });
      }
      
      // Extract report options
      const options = {
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        format: req.body.format || 'json'
      };
      
      // Generate report
      const report = await hipaaComplianceService.generateComplianceReport(options);
      
      // Log for audit trail
      await auditService.createSecurityAuditLog({
        action: 'compliance_report_generated',
        userId: req.user.id,
        metadata: {
          reportPeriodStart: report.periodStart,
          reportPeriodEnd: report.periodEnd
        }
      });
      
      // Return report
      res.status(200).json({
        success: true,
        report
      });
    } catch (error) {
      logger.error(`Error generating compliance report: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to generate compliance report',
        error: error.message
      });
    }
  }
  
  /**
   * Get user training status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getTrainingStatus(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Check if user has permission to view other users' training
      if (userId !== req.user.id && 
          !req.user.roles.some(role => ['admin', 'hr', 'training-manager'].includes(role))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view other users\' training status'
        });
      }
      
      // Get training status
      const trainingStatus = await hipaaComplianceService.getTrainingStatus(userId);
      
      // Return training status
      res.status(200).json({
        success: true,
        training: trainingStatus
      });
    } catch (error) {
      logger.error(`Error getting training status: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get training status',
        error: error.message
      });
    }
  }
  
  /**
   * Record training completion
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async recordTrainingCompletion(req, res) {
    try {
      const userId = req.params.userId || req.user.id;
      
      // Check if user has permission to record training for others
      if (userId !== req.user.id && 
          !req.user.roles.some(role => ['admin', 'hr', 'training-manager'].includes(role))) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to record training for other users'
        });
      }
      
      // Extract training details
      const trainingRecord = {
        userId: userId,
        module: req.body.module,
        score: req.body.score,
        email: req.body.email,
        userName: req.body.userName
      };
      
      // Validate required fields
      if (!trainingRecord.module || trainingRecord.score === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Module ID and score are required'
        });
      }
      
      // Record training completion
      const result = await hipaaComplianceService.recordTrainingCompletion(trainingRecord);
      
      // Return success
      res.status(200).json({
        success: true,
        message: 'Training completion recorded',
        training: {
          userId: result.userId,
          moduleId: result.moduleId,
          completionDate: result.completionDate,
          expirationDate: result.expirationDate,
          allModulesCompleted: result.allModulesCompleted
        }
      });
    } catch (error) {
      logger.error(`Error recording training completion: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to record training completion',
        error: error.message
      });
    }
  }
}

module.exports = new HipaaComplianceController();
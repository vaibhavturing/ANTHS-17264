const prelaunchCheckerService = require('../services/prelaunch-checker.service');
const logger = require('../utils/logger');

/**
 * Pre-Launch Checker Controller
 * API endpoints for the pre-launch checking system
 */
class PrelaunchCheckerController {
  /**
   * Run all pre-launch checks
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async runAllChecks(req, res) {
    try {
      // Check authorization - this endpoint should be restricted
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Admin privileges required for pre-launch checks'
        });
      }
      
      logger.info('Pre-launch checks requested', {
        userId: req.user.id,
        environment: process.env.NODE_ENV
      });
      
      // Run checks in the background to not block the response
      const checksPromise = prelaunchCheckerService.runAllChecks();
      
      // Return immediate response
      res.status(202).json({
        success: true,
        message: 'Pre-launch checks started',
        deploymentId: process.env.DEPLOYMENT_ID || `manual-${Date.now()}`,
        version: process.env.APP_VERSION || '0.0.0',
        environment: process.env.NODE_ENV || 'development',
        requestTime: new Date().toISOString(),
        status: 'in_progress'
      });
      
      // Handle background checks completion
      checksPromise
        .then(results => {
          logger.info('Background pre-launch checks completed', {
            overall: results.overall,
            checksCompleted: results.checksCompleted,
            userId: req.user.id
          });
        })
        .catch(error => {
          logger.error(`Background pre-launch checks failed: ${error.message}`, {
            error,
            userId: req.user.id
          });
        });
    } catch (error) {
      logger.error(`Error starting pre-launch checks: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to start pre-launch checks',
        error: error.message
      });
    }
  }
  
  /**
   * Get check results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getCheckResults(req, res) {
    try {
      // Check authorization
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Admin privileges required for pre-launch check results'
        });
      }
      
      // Get deploymentId from parameters or use the latest
      const deploymentId = req.params.deploymentId || process.env.DEPLOYMENT_ID;
      
      if (!deploymentId) {
        return res.status(400).json({
          success: false,
          message: 'Deployment ID is required'
        });
      }
      
      // Load results from file
      const results = await this.loadResultsFromFile(deploymentId);
      
      if (!results) {
        return res.status(404).json({
          success: false,
          message: 'No results found for the specified deployment ID'
        });
      }
      
      // Return results
      res.status(200).json({
        success: true,
        results
      });
    } catch (error) {
      logger.error(`Error getting pre-launch check results: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get pre-launch check results',
        error: error.message
      });
    }
  }
  
  /**
   * Load results from file
   * @param {string} deploymentId - Deployment ID
   * @returns {Promise<Object|null>} Check results or null if not found
   * @private
   */
  async loadResultsFromFile(deploymentId) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const logsDir = 'logs/prelaunch-checks';
      
      if (!fs.existsSync(logsDir)) {
        return null;
      }
      
      // Find all result files matching the deployment ID
      const files = fs.readdirSync(logsDir)
        .filter(file => file.includes(deploymentId) && file.endsWith('.json'))
        .sort()
        .reverse(); // Sort to get the latest first
      
      if (files.length === 0) {
        return null;
      }
      
      // Read the latest file
      const latestFile = path.join(logsDir, files[0]);
      const content = fs.readFileSync(latestFile, 'utf-8');
      
      // Parse and return
      return JSON.parse(content);
    } catch (error) {
      logger.error(`Failed to load results from file: ${error.message}`, { error });
      return null;
    }
  }
}

module.exports = new PrelaunchCheckerController();
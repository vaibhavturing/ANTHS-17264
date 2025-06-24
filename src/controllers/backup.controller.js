// src/controllers/backup.controller.js

const backupService = require('../services/backup.service');
const logger = require('../utils/logger');

/**
 * Backup Controller
 * Handles API endpoints related to backup operations
 */
class BackupController {
  /**
   * Trigger a manual backup
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async triggerBackup(req, res) {
    try {
      // Check authorization for backup operations
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Admin privileges required for backup operations'
        });
      }
      
      // Get options from request body
      const options = req.body.options || {};
      
      // Start backup in background
      const backupPromise = backupService.runFullBackup(options);
      
      // Immediately return a 202 Accepted with a task ID
      res.status(202).json({
        success: true,
        message: 'Backup started',
        backupId: `full-backup-${new Date().toISOString().slice(0, 19).replace(/[T:-]/g, '')}`,
        status: 'processing'
      });
      
      // Handle the backup in the background
      backupPromise
        .then(result => {
          logger.info(`Backup completed in background: ${result.backupId}`);
        })
        .catch(error => {
          logger.error(`Background backup failed: ${error.message}`, { error });
        });
    } catch (error) {
      logger.error(`Error triggering backup: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get backup status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getBackupStatus(req, res) {
    try {
      // Check authorization for backup operations
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Admin privileges required for backup operations'
        });
      }
      
      const backupId = req.params.backupId;
      
      // Get backup status from S3
      const listParams = {
        Bucket: backupService.s3.bucket,
        Prefix: `${backupService.s3.keyPrefix}/${process.env.NODE_ENV}/full/${backupId}`
      };
      
      const listResult = await backupService.s3.listObjectsV2(listParams).promise();
      
      if (!listResult.Contents || listResult.Contents.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Backup not found',
          backupId
        });
      }
      
      const backupObject = listResult.Contents[0];
      
      res.status(200).json({
        success: true,
        backupId,
        status: 'completed',
        timestamp: backupObject.LastModified,
        size: backupObject.Size,
        storageClass: backupObject.StorageClass
      });
    } catch (error) {
      logger.error(`Error getting backup status: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * List available backups
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async listBackups(req, res) {
    try {
      // Check authorization for backup operations
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Admin privileges required for backup operations'
        });
      }
      
      // Get query parameters
      const limit = parseInt(req.query.limit, 10) || 20;
      const type = req.query.type || 'full';
      
      // List backups from S3
      const listParams = {
        Bucket: backupService.s3.bucket,
        Prefix: `${backupService.s3.keyPrefix}/${process.env.NODE_ENV}/${type}/`,
        MaxKeys: limit
      };
      
      const listResult = await backupService.s3.listObjectsV2(listParams).promise();
      
      if (!listResult.Contents || listResult.Contents.length === 0) {
        return res.status(200).json({
          success: true,
          backups: []
        });
      }
      
      // Filter out non-backup files (e.g. checksum files)
      const backups = listResult.Contents
        .filter(obj => !obj.Key.endsWith('.checksum'))
        .map(obj => {
          // Extract backup ID from key
          const keyParts = obj.Key.split('/');
          const fileName = keyParts[keyParts.length - 1];
          const backupId = fileName.replace('.tar.gz.enc', '');
          
          return {
            backupId,
            key: obj.Key,
            timestamp: obj.LastModified,
            size: obj.Size,
            type: keyParts[keyParts.length - 2] // full or incremental
          };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by date, newest first
      
      res.status(200).json({
        success: true,
        count: backups.length,
        backups
      });
    } catch (error) {
      logger.error(`Error listing backups: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Get restore test results
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async getRestoreTestResults(req, res) {
    try {
      // Check authorization for backup operations
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Admin privileges required for backup operations'
        });
      }
      
      // Get query parameters
      const limit = parseInt(req.query.limit, 10) || 10;
      
      // List restore test reports from S3
      const listParams = {
        Bucket: backupService.s3.bucket,
        Prefix: `${backupService.s3.keyPrefix}/${process.env.NODE_ENV}/restore-tests/`,
        MaxKeys: limit
      };
      
      const listResult = await backupService.s3.listObjectsV2(listParams).promise();
      
      if (!listResult.Contents || listResult.Contents.length === 0) {
        return res.status(200).json({
          success: true,
          tests: []
        });
      }
      
      // Get the contents of each test report
      const tests = [];
      
      for (const obj of listResult.Contents) {
        // Skip non-report files
        if (!obj.Key.endsWith('-report.json')) {
          continue;
        }
        
        const getParams = {
          Bucket: backupService.s3.bucket,
          Key: obj.Key
        };
        
        const reportObj = await backupService.s3.getObject(getParams).promise();
        const report = JSON.parse(reportObj.Body.toString());
        
        tests.push({
          testId: report.testId,
          timestamp: report.timestamp,
          backupKey: report.backupKey,
          success: report.success,
          details: {
            postgres: report.postgres,
            mongodb: report.mongodb,
            fileSystem: report.fileSystem
          }
        });
      }
      
      // Sort by date, newest first
      tests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.status(200).json({
        success: true,
        count: tests.length,
        tests: tests.slice(0, limit)
      });
    } catch (error) {
      logger.error(`Error getting restore test results: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  /**
   * Trigger a manual restore test
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async triggerRestoreTest(req, res) {
    try {
      // Check authorization for backup operations
      if (!req.user || !req.user.roles.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: Admin privileges required for backup operations'
        });
      }
      
      // Start restore test in background
      const testPromise = backupService.performTestRestore();
      
      // Immediately return a 202 Accepted
      res.status(202).json({
        success: true,
        message: 'Restore test started',
        testId: `restore-test-${new Date().toISOString().slice(0, 19).replace(/[T:-]/g, '')}`,
        status: 'processing'
      });
      
      // Handle the test in the background
      testPromise
        .then(result => {
          logger.info(`Restore test completed in background: ${result.testId}, Success: ${result.success}`);
        })
        .catch(error => {
          logger.error(`Background restore test failed: ${error.message}`, { error });
        });
    } catch (error) {
      logger.error(`Error triggering restore test: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = new BackupController();
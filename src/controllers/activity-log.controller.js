// File: src/controllers/activity-log.controller.js
// New controller for handling activity log API endpoints

const activityLogService = require('../services/activity-log.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

/**
 * Controller for activity log related API endpoints
 */
const activityLogController = {
  /**
   * Get user's own activity logs
   * @route GET /api/activity-logs/my-activity
   * @access Private
   */
  getMyActivity: asyncHandler(async (req, res) => {
    const options = {
      userId: req.user._id,
      category: req.query.category,
      action: req.query.action,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };
    
    const result = await activityLogService.getUserActivityLogs(options);
    
    return ResponseUtil.success(res, result);
  }),
  
  /**
   * Search activity logs (admin only)
   * @route GET /api/activity-logs/search
   * @access Admin
   */
  searchActivityLogs: asyncHandler(async (req, res) => {
    const filters = {
      userId: req.query.userId,
      category: req.query.category,
      action: req.query.action,
      status: req.query.status,
      resourceType: req.query.resourceType,
      resourceId: req.query.resourceId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    const pagination = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };
    
    const result = await activityLogService.searchActivityLogs(filters, pagination);
    
    return ResponseUtil.success(res, result);
  }),
  
  /**
   * Get activity logs for a specific user (admin only)
   * @route GET /api/activity-logs/users/:userId
   * @access Admin
   */
  getUserActivity: asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    const options = {
      userId,
      category: req.query.category,
      action: req.query.action,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };
    
    const result = await activityLogService.getUserActivityLogs(options);
    
    return ResponseUtil.success(res, result);
  }),
  
  /**
   * Get access history for a resource
   * @route GET /api/activity-logs/resources/:resourceType/:resourceId
   * @access Admin or Resource Owner
   */
  getResourceAccessHistory: asyncHandler(async (req, res) => {
    const { resourceType, resourceId } = req.params;
    
    if (!resourceType || !resourceId) {
      throw new ValidationError('Resource type and ID are required');
    }
    
    const options = {
      userId: req.query.userId,
      action: req.query.action,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };
    
    const result = await activityLogService.getResourceAccessHistory(
      resourceType, 
      resourceId, 
      options
    );
    
    return ResponseUtil.success(res, result);
  }),
  
  /**
   * Generate compliance report
   * @route GET /api/activity-logs/compliance-report
   * @access Admin
   */
  generateComplianceReport: asyncHandler(async (req, res) => {
    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      format: req.query.format || 'json'
    };
    
    const report = await activityLogService.generateComplianceReport(options);
    
    // If CSV or PDF format is requested, generate file for download
    if (options.format === 'csv') {
      // Convert report to CSV and send as attachment
      // Implementation depends on your CSV generation library
      return ResponseUtil.success(res, { 
        message: 'Report created successfully',
        downloadUrl: '/api/activity-logs/download/report.csv'
      });
    } else if (options.format === 'pdf') {
      // Convert report to PDF and send as attachment
      // Implementation depends on your PDF generation library
      return ResponseUtil.success(res, { 
        message: 'Report created successfully',
        downloadUrl: '/api/activity-logs/download/report.pdf'
      });
    }
    
    // Default JSON response
    return ResponseUtil.success(res, { report });
  }),
  
  /**
   * Download a generated report file
   * @route GET /api/activity-logs/download/:filename
   * @access Admin
   */
  downloadReport: asyncHandler(async (req, res) => {
    const { filename } = req.params;
    
    // Logic to retrieve and send the generated report file
    // Implementation depends on where/how you store report files
    
    // For example, if using filesystem:
    // const filePath = path.join(__dirname, '../reports', filename);
    // res.download(filePath);
    
    // Placeholder implementation
    res.set('Content-Type', filename.endsWith('.csv') ? 'text/csv' : 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('Report data would be here');
  }),
  
  /**
   * Manually create an activity log (admin only)
   * @route POST /api/activity-logs
   * @access Admin
   */
  createActivityLog: asyncHandler(async (req, res) => {
    const logData = {
      ...req.body,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    const log = await activityLogService.createLog(logData);
    
    if (!log) {
      return ResponseUtil.error(res, 'Failed to create activity log', 500);
    }
    
    return ResponseUtil.success(res, { log }, 201);
  })
};

module.exports = activityLogController;
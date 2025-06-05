// File: src/middleware/activity-logger.middleware.js
// New middleware for automatic activity logging

const activityLogService = require('../services/activity-log.service');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/async-handler.util');

/**
 * Activity logger middleware for automatic logging of API requests
 */
const activityLoggerMiddleware = {
  /**
   * Log API request activity
   * Attaches to routes to automatically track API usage
   */
  logApiActivity: asyncHandler(async (req, res, next) => {
    // Skip health check or metrics endpoints
    if (req.path.includes('/health') || req.path.includes('/metrics')) {
      return next();
    }
    
    // Store original response methods for later
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;
    
    // Setup for capturing response
    let responseBody;
    
    // Override response methods to capture result
    res.send = function (body) {
      responseBody = body;
      return originalSend.apply(res, arguments);
    };
    
    res.json = function (body) {
      responseBody = body;
      return originalJson.apply(res, arguments);
    };
    
    // Get request start time
    const startTime = Date.now();
    
    // Capture request details
    const requestInfo = {
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      userId: req.user?._id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionId
    };
    
    // After response is sent, log the activity
    res.on('finish', async () => {
      try {
        // Calculate response time
        const responseTime = Date.now() - startTime;
        
        // Map HTTP status to activity status
        const statusMap = {
          1: 'info',
          2: 'success',
          3: 'info',
          4: 'denied',
          5: 'error'
        };
        
        // Map HTTP method to action
        const actionMap = {
          GET: 'read',
          POST: 'create',
          PUT: 'update',
          PATCH: 'update',
          DELETE: 'delete'
        };
        
        // Determine resource type from request path
        const pathParts = req.path.split('/').filter(Boolean);
        let resourceType = pathParts[1]; // Usually api/{resourceType}/...
        
        // Normalize certain resource types
        if (resourceType === 'medical-records') resourceType = 'medicalRecord';
        
        // Determine resourceId if present in URL
        const resourceId = pathParts[2] && pathParts[2].match(/^[0-9a-fA-F]{24}$/) 
          ? pathParts[2] 
          : null;
        
        // Determine status
        const statusCode = res.statusCode;
        const statusCategory = Math.floor(statusCode / 100);
        const status = statusMap[statusCategory] || 'info';
        
        // Determine action
        let action = actionMap[req.method] || 'access';
        
        // Refine action for authentication and special endpoints
        if (req.path.includes('/auth/login')) {
          action = 'login';
        } else if (req.path.includes('/auth/logout')) {
          action = 'logout';
        } else if (req.path.includes('/auth')) {
          action = req.path.split('/').pop(); // Use last path segment for auth actions
        }
        
        // Build description
        let description = `${req.method} ${req.path}`;
        if (statusCode >= 400) {
          description += ` (Failed: ${statusCode})`;
        }
        
        // Skip logging for certain activities if needed
        // if (path.includes('/health/check')) return;
        
        // Determine category based on path and method
        let category = 'api_access';
        if (req.path.includes('/auth')) {
          category = 'authentication';
        } else if (req.path.includes('/sessions')) {
          category = 'session_management';
        } else if (req.path.includes('/roles') || req.path.includes('/permissions')) {
          category = 'permission';
        } else if (req.path.includes('/users') || req.path.includes('/admin')) {
          category = 'user_management';
        } else if (req.path.includes('/export') || req.path.includes('/download')) {
          category = 'export';
        }
        
        // Create sanitized details object
        const details = {
          method: req.method,
          path: req.path,
          statusCode,
          responseTime,
          // Include only safe headers
          headers: {
            contentType: req.headers['content-type'],
            accept: req.headers['accept'],
            userAgent: req.headers['user-agent']
          }
        };
        
        // Log the activity
        await activityLogService.createLog({
          category,
          action,
          status,
          userId: req.user?._id,
          ipAddress: requestInfo.ipAddress,
          userAgent: requestInfo.userAgent,
          sessionId: requestInfo.sessionId,
          resourceType,
          resourceId,
          description,
          details
        });
      } catch (error) {
        // Log error but don't disrupt request flow
        logger.error('Error in activity logger middleware', {
          error: error.message,
          path: req.path
        });
      }
    });
    
    next();
  }),

  /**
   * Middleware that logs accessing sensitive data
   * Attach to specific routes with sensitive data
   * 
   * @param {Object} options - Logging options
   * @returns {Function} Express middleware
   */
  logSensitiveAccess: (options) => {
    return asyncHandler(async (req, res, next) => {
      // Continue processing the request first
      next();
      
      try {
        // After response is in flight, log the access
        await activityLogService.createLog({
          category: 'data_access',
          action: 'view',
          status: 'success',
          userId: req.user?._id,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers['user-agent'],
          resourceType: options.resourceType,
          resourceId: req.params.id || req.query.id,
          description: `Accessed sensitive ${options.resourceType} data`,
          details: {
            method: req.method,
            path: req.path,
            accessReason: req.query.reason || 'Not provided'
          },
          reason: req.query.reason
        });
      } catch (error) {
        // Just log error, don't disrupt response
        logger.error('Failed to log sensitive data access', { error: error.message });
      }
    });
  },

  /**
   * Create a middleware that logs permission checks
   * 
   * @param {string} resourceType - Type of resource
   * @param {string} action - Action being performed
   * @returns {Function} Express middleware
   */
  logPermissionCheck: (resourceType, action) => {
    return asyncHandler(async (req, res, next) => {
      // Store original permission check result
      const permissionCheckResult = res.locals.permissionCheckResult;
      
      // Call next middleware
      next();
      
      try {
        // After response is in flight, log the permission check
        if (typeof permissionCheckResult !== 'undefined') {
          await activityLogService.createLog({
            category: 'permission',
            action: `${action}_${resourceType}`,
            status: permissionCheckResult ? 'success' : 'denied',
            userId: req.user?._id,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            resourceType,
            resourceId: req.params.id || req.query.id,
            description: `Permission check for ${action} on ${resourceType}`,
            details: {
              method: req.method,
              path: req.path,
              result: permissionCheckResult
            }
          });
        }
      } catch (error) {
        // Just log error, don't disrupt response
        logger.error('Failed to log permission check', { error: error.message });
      }
    });
  }
};

module.exports = activityLoggerMiddleware;
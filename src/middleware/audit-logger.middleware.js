/**
 * Audit Logging Middleware
 * Automatically logs sensitive operations for HIPAA compliance
 */

const auditLogger = require('../utils/audit-logger');
const { getResourceTypeFromPath } = require('../utils/transform.util');

/**
 * Extract user ID from request
 * @param {Object} req - Express request object
 * @returns {string|null} User ID or null if not authenticated
 */
const extractUserId = (req) => {
  return req.user ? req.user.id : null;
};

/**
 * Extract resource ID from request parameters
 * @param {Object} req - Express request object
 * @returns {string|null} Resource ID or null if not available
 */
const extractResourceId = (req) => {
  // Try to get ID from route params
  if (req.params && req.params.id) {
    return req.params.id;
  }
  
  // If not in params, try to get from request body
  if (req.body && req.body.id) {
    return req.body.id;
  }
  
  return null;
};

/**
 * Middleware to audit access to sensitive resources
 * @returns {Function} Express middleware
 */
const auditResourceAccess = () => {
  return (req, res, next) => {
    // Skip auditing for non-sensitive routes
    const nonSensitiveRoutes = [
      '/health', 
      '/public', 
      '/static',
      '/docs',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password'
    ];
    
    if (nonSensitiveRoutes.some(route => req.path.startsWith(route))) {
      return next();
    }
    
    // Determine action based on HTTP method
    const methodToActionMap = {
      GET: 'view',
      POST: 'create',
      PUT: 'update',
      PATCH: 'partial_update',
      DELETE: 'delete'
    };
    
    const action = methodToActionMap[req.method] || 'access';
    
    // Get resource type from path
    const resourceType = getResourceTypeFromPath(req.path);
    
    // Only log if we have a valid resource type
    if (resourceType) {
      const userId = extractUserId(req);
      const resourceId = extractResourceId(req);
      
      // Log data access for GET requests
      if (req.method === 'GET') {
        auditLogger.logDataAccess({
          userId,
          action,
          resourceType,
          resourceId,
          metadata: {
            query: req.query,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.correlationId
          }
        });
      } 
      // Log data modification for other methods
      else {
        auditLogger.logDataModification({
          userId,
          action,
          resourceType,
          resourceId,
          // Include only necessary parts of the body for auditing
          changes: {
            changedFields: Object.keys(req.body || {})
          },
          metadata: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.correlationId
          }
        });
      }
    }
    
    next();
  };
};

/**
 * Middleware to audit authentication events
 * @returns {Function} Express middleware for auth routes
 */
const auditAuthentication = () => {
  return (req, res, next) => {
    // Original response.end
    const originalEnd = res.end;
    
    // Override end method to capture response status
    res.end = function(chunk, encoding) {
      // Restore original end method
      res.end = originalEnd;
      
      // Call original end method
      res.end(chunk, encoding);
      
      const isAuthRoute = req.path.startsWith('/api/auth');
      if (!isAuthRoute) {
        return;
      }
      
      let action = 'unknown';
      let userId = null;
      
      // Determine authentication action
      if (req.path.endsWith('/login')) {
        action = res.statusCode === 200 ? 'login_success' : 'login_failure';
        // Extract userId from response if successful login
        if (res.statusCode === 200 && res.locals.userId) {
          userId = res.locals.userId;
        }
      } else if (req.path.endsWith('/logout')) {
        action = 'logout';
        userId = extractUserId(req);
      } else if (req.path.endsWith('/register')) {
        action = res.statusCode === 201 ? 'registration' : 'registration_failure';
        // New user ID would be in response
        if (res.statusCode === 201 && res.locals.userId) {
          userId = res.locals.userId;
        }
      }
      
      // Log authentication event
      auditLogger.logAuthentication({
        userId,
        action,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          correlationId: req.correlationId
        }
      });
    };
    
    next();
  };
};

/**
 * Middleware for auditing security events like permission denied
 * @param {Object} options - Options for security auditing
 * @param {string} options.action - Security action type
 * @returns {Function} Express middleware
 */
const auditSecurityEvent = (options) => {
  return (req, res, next) => {
    const userId = extractUserId(req);
    const resourceType = getResourceTypeFromPath(req.path);
    const resourceId = extractResourceId(req);
    
    auditLogger.logSecurity({
      userId,
      action: options.action,
      resourceType,
      resourceId,
      ipAddress: req.ip,
      metadata: {
        path: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
        correlationId: req.correlationId
      }
    });
    
    next();
  };
};

module.exports = {
  auditResourceAccess,
  auditAuthentication,
  auditSecurityEvent
};
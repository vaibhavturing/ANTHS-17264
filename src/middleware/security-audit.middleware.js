// src/middleware/security-audit.middleware.js

/**
 * Security audit logging middleware
 * Captures security-relevant events and logs them for compliance and auditing
 */

const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Middleware for logging security-relevant operations for audit purposes
 * Particularly important for HIPAA compliance
 */
const securityAuditLogger = (req, res, next) => {
  // Skip logging for certain paths
  const skipPaths = ['/health', '/metrics', '/favicon.ico'];
  if (skipPaths.some(path => req.path.endsWith(path))) {
    return next();
  }
  
  // Capture original end method to intercept responses
  const originalEnd = res.end;
  
  // Get user info if available
  const userId = req.user?.id || 'unauthenticated';
  const userRole = req.user?.role || 'none';
  
  // Standard audit log fields
  const auditLog = {
    timestamp: new Date().toISOString(),
    userId,
    userRole,
    ip: req.ip,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.get('user-agent') || 'unknown',
    referrer: req.get('referer') || 'none',
    // For HIPAA, tracking patient record access is critical
    patientId: req.params.patientId || req.query.patientId || null,
    action: getActionType(req),
    resourceType: getResourceType(req)
  };
  
  // Add request start time
  req.auditStartTime = Date.now();
  
  // Special handling for sensitive operations
  const isSensitiveOperation = checkIfSensitiveOperation(req);
  
  // Log request received for sensitive operations
  if (isSensitiveOperation) {
    logger.info('SECURITY_AUDIT: Sensitive operation initiated', {
      ...auditLog,
      eventType: 'sensitive_operation_started'
    });
  }
  
  // Override response end method to capture completion
  res.end = function (chunk, encoding) {
    // Restore original end method
    res.end = originalEnd;
    
    // Calculate response time
    const responseTime = Date.now() - req.auditStartTime;
    
    // Add response information to audit log
    auditLog.statusCode = res.statusCode;
    auditLog.responseTime = responseTime;
    auditLog.successful = res.statusCode < 400;
    
    // Log appropriately based on operation type and outcome
    if (isSensitiveOperation || res.statusCode >= 400) {
      const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
      const eventType = isSensitiveOperation 
        ? 'sensitive_operation_completed' 
        : 'standard_operation_completed';
      
      // Log to appropriate channel
      logger[logLevel](`SECURITY_AUDIT: ${getOperationDescription(req, res.statusCode)}`, {
        ...auditLog,
        eventType
      });
    }
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Determine if the request is for a sensitive operation
 * that requires additional security logging
 */
function checkIfSensitiveOperation(req) {
  // Sensitive paths that should always be audited
  const sensitivePaths = [
    '/medical-records', 
    '/patients', 
    '/appointments',
    '/billing',
    '/prescriptions',
    '/admin',
    '/auth/reset-password',
    '/auth/change-password'
  ];
  
  // Check if path contains sensitive sections
  const isSensitivePath = sensitivePaths.some(path => 
    req.path.includes(path) || req.originalUrl.includes(path)
  );
  
  // Check if this is a write operation
  const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  
  // Login attempts should always be audited
  const isLoginAttempt = req.path.includes('/auth/login') || 
                         req.path.includes('/auth/token');
  
  return isSensitivePath || isWriteOperation || isLoginAttempt;
}

/**
 * Get a descriptive name for the operation being performed
 */
function getOperationDescription(req, statusCode) {
  const method = req.method;
  const path = req.originalUrl;
  const isSuccessful = statusCode < 400;
  const status = isSuccessful ? 'successfully' : 'unsuccessfully';
  
  // Authentication operations
  if (path.includes('/auth/login')) {
    return `User login attempt ${status}`;
  }
  
  if (path.includes('/auth/register')) {
    return `User registration ${status}`;
  }
  
  if (path.includes('/auth/reset-password')) {
    return `Password reset ${status}`;
  }
  
  // Resource operations
  const resourceType = getResourceType(req);
  
  switch (method) {
    case 'GET':
      return `${resourceType} accessed ${status}`;
    case 'POST':
      return `${resourceType} created ${status}`;
    case 'PUT':
    case 'PATCH':
      return `${resourceType} updated ${status}`;
    case 'DELETE':
      return `${resourceType} deleted ${status}`;
    default:
      return `Operation on ${resourceType} performed ${status}`;
  }
}

/**
 * Determine the action being performed
 */
function getActionType(req) {
  switch (req.method) {
    case 'GET': return 'read';
    case 'POST': return 'create';
    case 'PUT': 
    case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'access';
  }
}

/**
 * Determine the type of resource being accessed
 */
function getResourceType(req) {
  const path = req.path.toLowerCase();
  
  if (path.includes('/patients')) return 'Patient';
  if (path.includes('/doctors')) return 'Doctor';
  if (path.includes('/appointments')) return 'Appointment';
  if (path.includes('/medical-records')) return 'MedicalRecord';
  if (path.includes('/users')) return 'User';
  if (path.includes('/auth')) return 'Authentication';
  if (path.includes('/admin')) return 'Administration';
  
  // Try to extract from path segments
  const segments = path.split('/').filter(s => s);
  if (segments.length > 0) {
    // Get the last meaningful segment
    for (let i = segments.length - 1; i >= 0; i--) {
      // Skip ids and api version
      if (!segments[i].match(/^v\d+$/) && !segments[i].match(/^[0-9a-f]{24}$/)) {
        return segments[i].charAt(0).toUpperCase() + segments[i].slice(1);
      }
    }
  }
  
  return 'Resource';
}

module.exports = securityAuditLogger;
// src/middleware/audit-log.middleware.js

const AuditService = require('../services/audit.service');
const logger = require('../utils/logger');

/**
 * Middleware factory to create audit log entries for various operations
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware function
 */
const auditLogMiddleware = (options = {}) => {
  const {
    entityType,                // Type of entity being accessed/modified (e.g., 'Patient', 'MedicalRecord')
    getEntityId = req => req.params.id,  // Function to extract entity ID from request
    getPatientId = req => null, // Function to extract patient ID from request
    actionType = req => {       // Function to determine action type from request
      const method = req.method.toLowerCase();
      switch (method) {
        case 'get':
          return 'view';
        case 'post':
          return 'create';
        case 'put':
        case 'patch':
          return 'update';
        case 'delete':
          return 'delete';
        default:
          return 'view';
      }
    },
    getDescription = req => {   // Function to generate description
      const method = req.method.toLowerCase();
      const id = getEntityId(req);
      
      switch (method) {
        case 'get':
          return `Viewed ${entityType} ${id ? `(ID: ${id})` : ''}`;
        case 'post':
          return `Created new ${entityType} ${id ? `(ID: ${id})` : ''}`;
        case 'put':
        case 'patch':
          return `Updated ${entityType} ${id ? `(ID: ${id})` : ''}`;
        case 'delete':
          return `Deleted ${entityType} ${id ? `(ID: ${id})` : ''}`;
        default:
          return `Accessed ${entityType} ${id ? `(ID: ${id})` : ''}`;
      }
    },
    getChanges = req => {       // Function to extract changes for update operations
      if (req.method.toLowerCase() === 'get') {
        return null;
      }
      
      // Return the request body for POST/PUT/PATCH operations
      return req.body;
    },
    shouldLog = req => true     // Function to determine if this request should be logged
  } = options;

  return async (req, res, next) => {
    // Original end function
    const originalEnd = res.end;
    
    // Flag to ensure we only log once
    let logged = false;
    
    // Override end function to capture the response
    res.end = async function(...args) {
      // If already logged, don't log again
      if (logged) {
        return originalEnd.apply(this, args);
      }
      
      // Mark as logged
      logged = true;
      
      // Only log if shouldLog function returns true
      if (!shouldLog(req)) {
        return originalEnd.apply(this, args);
      }
      
      try {
        // Extract data for the audit log
        const userId = req.user?._id; // Assumes req.user is set by auth middleware
        
        // Skip logging if no user is authenticated
        if (!userId) {
          return originalEnd.apply(this, args);
        }
        
        const entityId = getEntityId(req);
        const patientId = getPatientId(req);
        const action = actionType(req);
        const description = getDescription(req);
        const changes = getChanges(req);
        
        // Check if operation was successful (HTTP 2xx response)
        const successful = res.statusCode >= 200 && res.statusCode < 300;
        
        // Get IP address from request
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        
        // Create the audit log asynchronously (don't wait for it)
        AuditService.createLog({
          userId,
          entityType,
          entityId,
          patientId,
          action,
          description,
          changes,
          successful,
          failureReason: !successful ? `HTTP ${res.statusCode}` : null,
          ipAddress,
          userAgent: req.headers['user-agent']
        }).catch(err => {
          logger.error(`Failed to create audit log: ${err.message}`, { err });
        });
      } catch (error) {
        // Log error but don't disrupt the request flow
        logger.error(`Error in audit middleware: ${error.message}`, { error });
      }
      
      // Call the original end function
      return originalEnd.apply(this, args);
    };
    
    // Continue with the request
    next();
  };
};

module.exports = auditLogMiddleware;
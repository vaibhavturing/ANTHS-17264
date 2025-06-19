// src/middleware/phi-access-audit.middleware.js
// HIPAA Data Access Audit Middleware
// NEW FILE: Dedicated middleware for tracking all PHI data access

const hipaaAuditLogger = require('../utils/audit-logger');

/**
 * Middleware to log access to Protected Health Information (PHI)
 * Tracks all access to patient data for HIPAA compliance
 * 
 * This provides a detailed audit trail of who accessed what PHI,
 * when they accessed it, and for what purpose
 */
const phiAccessAuditMiddleware = {
  /**
   * Log access to patient PHI
   * @param {Object} options - Configuration options
   * @param {string} options.resourceType - Resource type (e.g., 'patient', 'medicalRecord')
   * @param {Function} options.getResourceId - Function to extract resource ID from request
   * @param {string} options.accessReason - Reason for access (e.g., 'TREATMENT', 'PAYMENT', 'OPERATIONS')
   */
  logAccess: (options = {}) => {
    return async (req, res, next) => {
      try {
        // Get resource type (default to path-based detection)
        const resourceType = options.resourceType || 
                          req.path.split('/')[1] || 
                          'unknown';
        
        // Extract resource ID
        let resourceId;
        if (typeof options.getResourceId === 'function') {
          resourceId = options.getResourceId(req);
        } else {
          resourceId = req.params.id || 
                      req.params.patientId || 
                      req.query.id || 
                      req.query.patientId || 
                      'unknown';
        }
        
        // Get access reason (required for HIPAA)
        let accessReason = options.accessReason || 'TREATMENT';
        
        // Check for X-Access-Reason header (often used in healthcare systems)
        if (req.headers['x-access-reason']) {
          accessReason = req.headers['x-access-reason'];
        }
        
        // Get user information
        const actor = {
          userId: req.user?._id || 'unauthenticated',
          userName: req.user?.name || req.user?.firstName || 'Unknown User',
          role: req.user?.role || 'unknown',
          ipAddress: req.ip || req.connection.remoteAddress
        };
        
        // Record the PHI access
        await hipaaAuditLogger.logPatientDataAccess({
          accessReason,
          method: req.method,
          url: req.originalUrl,
          accessTime: new Date(),
          userAgent: req.headers['user-agent'],
          // Include break-the-glass reason if provided
          breakTheGlassReason: req.headers['x-break-glass-reason']
        }, actor, resourceId);
        
        // HIPAA compliance: Track the response
        const originalSend = res.send;
        
        // Wrap the response to log what data was returned
        res.send = function(body) {
          try {
            // Try to parse the response (if JSON)
            let responseData;
            try {
              if (typeof body === 'string') {
                responseData = JSON.parse(body);
              } else {
                responseData = body;
              }
              
              // Log what fields were included in the response (without the values)
              const includedFields = [];
              
              // Check for common PHI fields in response
              if (responseData.patient || responseData.appointment || responseData.medicalRecord) {
                const dataObj = responseData.patient || responseData.appointment || responseData.medicalRecord;
                
                // Extract field names without values
                const extractFields = (obj, prefix = '') => {
                  if (!obj || typeof obj !== 'object') return;
                  
                  Object.keys(obj).forEach(key => {
                    const fieldName = prefix ? `${prefix}.${key}` : key;
                    
                    // Skip non-PHI fields
                    if (['id', '_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
                      return;
                    }
                    
                    includedFields.push(fieldName);
                    
                    // Recurse into nested objects
                    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                      extractFields(obj[key], fieldName);
                    }
                  });
                };
                
                extractFields(dataObj);
                
                // Update the audit log with the fields returned
                hipaaAuditLogger.logPatientDataAccess({
                  accessReason,
                  responseFields: includedFields,
                  responseStatus: res.statusCode,
                  responseTime: new Date()
                }, actor, resourceId);
              }
              
            } catch (parseError) {
              // If can't parse, just log that response was sent
              hipaaAuditLogger.logPatientDataAccess({
                accessReason,
                responseStatus: res.statusCode,
                responseTime: new Date(),
                parseError: parseError.message
              }, actor, resourceId);
            }
            
          } catch (error) {
            console.error('Error logging PHI response:', error);
          }
          
          // Continue with the response
          return originalSend.call(this, body);
        };
        
        // Continue with the request
        next();
      } catch (error) {
        console.error('PHI access audit error:', error);
        // Don't block the request if logging fails
        next();
      }
    };
  },
  
  /**
   * Break-the-glass access for emergency situations
   * Implements the HIPAA emergency access provision
   */
  breakTheGlass: (options = {}) => {
    return async (req, res, next) => {
      try {
        // Check if break-glass header is present and valid
        const breakGlassReason = req.headers['x-break-glass-reason'];
        if (!breakGlassReason) {
          return res.status(403).json({
            success: false,
            error: {
              message: 'Break-glass reason required for emergency access',
              code: 'BREAK_GLASS_REQUIRED'
            }
          });
        }
        
        // Get user information
        const actor = {
          userId: req.user?._id || 'unauthenticated',
          userName: req.user?.name || req.user?.firstName || 'Unknown User',
          role: req.user?.role || 'unknown',
          ipAddress: req.ip || req.connection.remoteAddress
        };
        
        // Determine resource type & ID
        const resourceType = options.resourceType || req.path.split('/')[1] || 'unknown';
        
        let resourceId;
        if (typeof options.getResourceId === 'function') {
          resourceId = options.getResourceId(req);
        } else {
          resourceId = req.params.id || req.params.patientId || 'unknown';
        }
        
        // Log the break-glass access with HIGH priority
        await hipaaAuditLogger.log('BREAK_GLASS_ACCESS', {
          reason: breakGlassReason,
          method: req.method,
          url: req.originalUrl,
          timestamp: new Date(),
          userAgent: req.headers['user-agent'],
          priority: 'HIGH' // Ensure this is flagged for review
        }, actor, {
          type: resourceType,
          id: resourceId
        });
        
        // Send alert notification to compliance team (implementation depends on notification system)
        // notificationService.sendUrgent('compliance-team', {
        //   subject: 'Break-Glass PHI Access',
        //   message: `User ${actor.userName} (${actor.userId}) has used emergency access for ${resourceType} ${resourceId}.`
        // });
        
        // Continue - the regular PHI access middleware will also log this
        next();
      } catch (error) {
        console.error('Break-glass logging error:', error);
        // Continue anyway for emergency access
        next();
      }
    };
  }
};

module.exports = phiAccessAuditMiddleware;
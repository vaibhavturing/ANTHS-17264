// src/middleware/permission.middleware.js
const logger = require('../utils/logger');


/**
 * Permission checking middleware factory
 * IMPORTANT: This implementation supports both object-style and function-style calls
 */
function permissionMiddleware(permissionString) {
  // When called as a function directly
  if (typeof permissionString === 'string') {
    // Extract resource and action from the permission string ('resource:action')
    const [resource, action] = permissionString.split(':');
    
    // Return middleware function
    return (req, res, next) => {
      try {
        // Get user from the request (should be set by auth middleware)
        const user = req.user;
        
        if (!user) {
          logger.warn('Permission check failed: No authenticated user found');
          return res.status(401).json({
            success: false,
            error: {
              message: 'Authentication required',
              type: 'UNAUTHORIZED'
            }
          });
        }
        
        // Simple role-based check
        if (user.role === 'admin') {
          // Admin has all permissions
          return next();
        }
        
        // Basic role-based permissions
        const rolePermissions = {
          doctor: {
            appointments: ['read', 'create', 'update'],
            patients: ['read', 'update'],
            medicalRecords: ['read', 'create', 'update'],
            communications: ['create', 'read']
          },
          nurse: {
            appointments: ['read', 'create', 'update'],
            patients: ['read', 'update'],
            medicalRecords: ['read', 'create', 'update'],
            communications: ['create', 'read']
          },
          patient: {
            appointments: ['read', 'create'],
            medicalRecords: ['read'],
            communications: ['create', 'read']
          }
        };
        
        const userPermissions = rolePermissions[user.role] || {};
        const resourcePermissions = userPermissions[resource] || [];
        
        if (resourcePermissions.includes(action)) {
          return next();
        }
        
        logger.warn(`Permission denied: User ${user.id} with role ${user.role} tried to ${action} on ${resource}`);
        return res.status(403).json({
          success: false,
          error: {
            message: 'You do not have permission to perform this action',
            type: 'FORBIDDEN'
          }
        });
      } catch (error) {
        logger.error('Permission middleware error', { error: error.message });
        return res.status(500).json({
          success: false,
          error: {
            message: 'Internal server error during permission check',
            type: 'INTERNAL_ERROR'
          }
        });
      }
    };
  }
  
  // When called improperly, throw an error
  throw new Error('permissionMiddleware must be called with a permission string in format "resource:action"');
}

/**
 * Check if the user has permission to access a resource
 * @param {string} resource - The resource being accessed
 * @param {string} action - The action being performed
 * @returns {function} - Express middleware function
 */
permissionMiddleware.checkPermission = (resource, action) => {
  // Call the function form with the combined permission string
  return permissionMiddleware(`${resource}:${action}`);
};

/**
 * Check if the user owns the resource they are trying to access
 * @param {string} resourceType - Type of resource (patient, doctor, etc.)
 * @returns {function} - Express middleware function
 */
permissionMiddleware.checkResourceOwnership = (resourceType) => {
  return (req, res, next) => {
    try {
      // Get user from the request
      const user = req.user;
      
      if (!user) {
        logger.warn('Ownership check failed: No authenticated user found');
        return res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            type: 'UNAUTHORIZED'
          }
        });
      }
      
      // Admin can access all resources
      if (user.role === 'admin') {
        return next();
      }
      
      // Allow healthcare providers to access patient data
      if (['doctor', 'nurse'].includes(user.role) && resourceType === 'patient') {
        return next();
      }
      
      // Simplified ownership validation
      let resourceId;
      
      switch (resourceType) {
        case 'patient':
          resourceId = req.params.patientId;
          break;
        default:
          resourceId = req.params[`${resourceType}Id`];
      }
      
      // Check if the patient ID in the request matches the user's associated patient
      if (user.role === 'patient' && user.patientId && user.patientId.toString() === resourceId) {
        return next();
      }
      
      logger.warn(`Ownership validation failed: User ${user.id} tried to access ${resourceType} ${resourceId}`);
      return res.status(403).json({
        success: false,
        error: {
          message: 'You do not have permission to access this resource',
          type: 'FORBIDDEN'
        }
      });
    } catch (error) {
      logger.error('Resource ownership check error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error during resource ownership check',
          type: 'INTERNAL_ERROR'
        }
      });
    }
  };
};

module.exports = permissionMiddleware;
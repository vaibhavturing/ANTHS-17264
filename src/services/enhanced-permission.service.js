// src/services/enhanced-permission.service.js
const { Permission, Role, User } = require('../models');
const logger = require('../utils/logger');
const { AuthorizationError } = require('../utils/errors');

/**
 * Enhanced service for more complex permission management
 * Extends the base permission service with advanced functionality
 */
const enhancedPermissionService = {
  /**
   * Check permission with complex conditional evaluation
   * @param {Object} user - User object
   * @param {string} resource - Resource name
   * @param {string} action - Action to perform
   * @param {Object} context - Context data for condition evaluation
   * @returns {Promise<boolean>} - Permission check result
   */
  checkComplexPermission: async (user, resource, action, context = {}) => {
    try {
      if (!user || !user._id) {
        return false;
      }

      // Find the specific permission
      const permission = await Permission.findOne({ resource, action });
      if (!permission) {
        logger.warn(`Permission not found for ${action} on ${resource}`);
        return false;
      }

      // Ensure user roles are populated
      if (!user.populated('roles')) {
        await user.populate('roles');
      }
      
      // If user has no roles, use legacy role
      if (!user.roles || user.roles.length === 0) {
        const defaultRole = await Role.findOne({ name: user.role });
        if (!defaultRole) {
          return false;
        }
        user.roles = [defaultRole];
      }

      // Enhanced context with resource information
      const enhancedContext = {
        ...context,
        userId: user._id,
        userRoles: user.roles.map(r => r.name),
        userRoleLevel: Math.max(...user.roles.map(r => r.level || 0), 0),
        resource,
        action
      };
      
      // Check for special resource-specific conditions
      const specificConditions = await evaluateSpecificConditions(
        user, resource, enhancedContext
      );
      
      if (specificConditions === false) {
        return false;
      }

      // Check if any role has the permission
      for (const role of user.roles) {
        // Check if role has the permission directly or through inheritance
        const hasPermission = await role.hasPermission(permission._id);
        
        if (hasPermission) {
          // Check if permission conditions are met 
          if (permission.evaluateConditions(enhancedContext)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      logger.error('Complex permission check failed', {
        userId: user?._id,
        resource,
        action,
        error: error.message
      });
      return false;
    }
  },
  
  /**
   * Evaluate a user's effective permissions for a specific resource
   * @param {Object} user - User object
   * @param {string} resource - Resource name
   * @returns {Promise<Array>} - List of permitted actions
   */
  getUserResourcePermissions: async (user, resource) => {
    try {
      if (!user || !user._id) {
        return [];
      }
      
      // Get all permissions for this resource type
      const resourcePermissions = await Permission.find({ resource });
      if (resourcePermissions.length === 0) {
        return [];
      }
      
      // Ensure roles are populated
      if (!user.populated('roles')) {
        await user.populate('roles');
      }
      
      // If user has no roles, use legacy role
      if (!user.roles || user.roles.length === 0) {
        const defaultRole = await Role.findOne({ name: user.role });
        if (defaultRole) {
          user.roles = [defaultRole];
        } else {
          return [];
        }
      }
      
      // Get all permissions from all roles
      const permissionIds = [];
      for (const role of user.roles) {
        const rolePermissions = await role.getAllPermissions();
        permissionIds.push(...rolePermissions);
      }
      
      // Filter to get only permissions for this resource that the user has
      const effectivePermissions = [];
      
      for (const permission of resourcePermissions) {
        if (permissionIds.includes(permission._id.toString())) {
          effectivePermissions.push(permission.action);
        }
      }
      
      return [...new Set(effectivePermissions)]; // Remove duplicates
    } catch (error) {
      logger.error('Error getting user resource permissions', {
        userId: user?._id,
        resource,
        error: error.message
      });
      return [];
    }
  },
  
  /**
   * Get a permission map for all resources a user has access to
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Map of resources to permitted actions
   */
  getUserPermissionMap: async (user) => {
    try {
      if (!user || !user._id) {
        return {};
      }
      
      // Ensure roles are populated
      if (!user.populated('roles')) {
        await user.populate({ 
          path: 'roles',
          populate: { path: 'permissions' }
        });
      }
      
      // If user has no roles, use legacy role
      if (!user.roles || user.roles.length === 0) {
        const defaultRole = await Role.findOne({ name: user.role }).populate('permissions');
        if (defaultRole) {
          user.roles = [defaultRole];
        } else {
          return {};
        }
      }
      
      // Collect all permissions from all roles
      const permissionMap = {};
      
      for (const role of user.roles) {
        const permissions = await Permission.find({
          _id: { $in: await role.getAllPermissions() }
        });
        
        for (const permission of permissions) {
          if (!permissionMap[permission.resource]) {
            permissionMap[permission.resource] = [];
          }
          
          if (!permissionMap[permission.resource].includes(permission.action)) {
            permissionMap[permission.resource].push(permission.action);
          }
        }
      }
      
      return permissionMap;
    } catch (error) {
      logger.error('Error getting user permission map', {
        userId: user?._id,
        error: error.message
      });
      return {};
    }
  }
};

/**
 * Helper function to evaluate resource-specific conditions
 * This can be extended for different resources
 * @param {Object} user - User object
 * @param {string} resource - Resource type
 * @param {Object} context - Context data
 * @returns {Promise<boolean>} - Whether the specific conditions pass
 */
async function evaluateSpecificConditions(user, resource, context) {
  try {
    // Handle specific resource types
    switch(resource) {
      case 'patient':
        return handlePatientPermission(user, context);
      case 'medicalRecord':
        return handleMedicalRecordPermission(user, context);
      case 'appointment':
        return handleAppointmentPermission(user, context);
      case 'doctor':
        return handleDoctorPermission(user, context);
      default:
        // No specific handling needed
        return true;
    }
  } catch (error) {
    logger.error('Error evaluating specific conditions', {
      error: error.message,
      resource
    });
    return false;
  }
}

/**
 * Patient-specific permission logic
 */
async function handlePatientPermission(user, context) {
  // Example: Additional patient-specific logic
  // This could check department, specialty, etc.
  return true;
}

/**
 * Medical record-specific permission logic
 */
async function handleMedicalRecordPermission(user, context) {
  // Example: Check if this is patient's own record
  if (context.resourceId && user.patientId) {
    // Here you could check if the medical record belongs to this patient
    return true;
  }
  
  // For healthcare providers, additional checks can be performed
  return true;
}

/**
 * Appointment-specific permission logic
 */
async function handleAppointmentPermission(user, context) {
  // Example: Check if user is the doctor or patient for this appointment
  return true;
}

/**
 * Doctor-specific permission logic
 */
async function handleDoctorPermission(user, context) {
  // Example: Department heads can manage doctors in their department
  return true;
}

module.exports = enhancedPermissionService;
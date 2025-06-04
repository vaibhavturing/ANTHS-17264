// src/middleware/rbac.middleware.js
const { permissionService, roleService } = require('../services');
const logger = require('../utils/logger');
const { AuthorizationError } = require('../utils/errors');
const asyncHandler = require('../utils/async-handler.util');
const mongoose = require('mongoose');

/**
 * Enhanced middleware for Role-based Access Control (RBAC) functionality
 */
const rbacMiddleware = {
  /**
   * Permission decorator that can be applied directly to routes
   * @param {string} resource - The resource type
   * @param {string} action - The action on resource
   * @param {Object} options - Additional options
   * @returns {Function} - Express middleware
   */
  requirePermission: (resource, action, options = {}) => {
    return asyncHandler(async (req, res, next) => {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }

      // Default context builder
      const defaultContext = () => ({ 
        resourceId: req.params.id || null,
        method: req.method,
        path: req.path,
        query: req.query
      });
      
      // Get context either from options.contextBuilder or use default
      const context = options.contextBuilder 
        ? await options.contextBuilder(req)
        : defaultContext();
      
      try {
        await permissionService.assertPermission(
          req.user,
          resource,
          action,
          context
        );
        next();
      } catch (error) {
        next(error);
      }
    });
  },
  
  /**
   * Check access based on resource ownership
   * @param {Object} options - Configuration options
   * @returns {Function} - Express middleware
   */
  requireOwnership: (options) => {
    const {
      resource,
      action,
      idParam = 'id',
      idField = '_id',
      ownerField = 'userId',
      modelName,
      fallbackMiddleware
    } = options;
    
    return asyncHandler(async (req, res, next) => {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }
      
      try {
        // First check if user has unconditional permission (e.g. admin)
        const hasUnconditionalPermission = await permissionService.checkPermission(
          req.user, resource, action
        );
        
        if (hasUnconditionalPermission) {
          return next();
        }
        
        // Get resource ID from request
        const resourceId = req.params[idParam];
        if (!resourceId) {
          throw new Error(`Resource ID not found in request params: ${idParam}`);
        }
        
        // Find the resource to check ownership
        if (!modelName) {
          throw new Error('Model name must be provided for ownership check');
        }
        
        const Model = mongoose.model(modelName);
        const resourceObj = await Model.findOne({ 
          [idField]: resourceId 
        });
        
        if (!resourceObj) {
          throw new Error(`${resource} not found`);
        }
        
        // Check ownership
        const isOwner = resourceObj[ownerField] && 
          resourceObj[ownerField].toString() === req.user._id.toString();
        
        if (isOwner) {
          // Add ownership info to request for downstream handlers
          req.isResourceOwner = true;
          
          // Check permission with ownership context
          const hasPermission = await permissionService.checkPermission(
            req.user, resource, action, { isOwner: true }
          );
          
          if (hasPermission) {
            return next();
          }
        }
        
        // If not owner or no permission with ownership, try fallback middleware
        if (fallbackMiddleware) {
          return fallbackMiddleware(req, res, next);
        }
        
        // No ownership, no fallback, deny access
        throw new AuthorizationError(`You don't have permission to ${action} this ${resource}`);
      } catch (error) {
        next(error);
      }
    });
  },
  
  /**
   * Check if user has required role level
   * @param {number} level - Minimum role level required
   * @returns {Function} - Express middleware
   */
  requireLevel: (level) => {
    return asyncHandler(async (req, res, next) => {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }
      
      try {
        // Populate roles if not already populated
        if (!req.user.populated('roles')) {
          await req.user.populate('roles');
        }
        
        // Get max role level
        const userMaxLevel = Math.max(
          ...req.user.roles.map(role => role.level),
          0
        );
        
        if (userMaxLevel >= level) {
          return next();
        }
        
        throw new AuthorizationError('Insufficient role level');
      } catch (error) {
        next(error);
      }
    });
  },
  
  /**
   * Check access based on hierarchy relationship
   * For example, doctors can only access patients in their department
   * @param {Object} options - Configuration options
   * @returns {Function} - Express middleware
   */
  requireHierarchical: (options) => {
    const {
      resource,
      action,
      idParam = 'id',
      relationshipField,
      relationshipCheck,
      modelName
    } = options;
    
    return asyncHandler(async (req, res, next) => {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }
      
      try {
        // First check if user has unconditional permission
        const hasUnconditionalPermission = await permissionService.checkPermission(
          req.user, resource, action
        );
        
        if (hasUnconditionalPermission) {
          return next();
        }
        
        // Get resource ID from request
        const resourceId = req.params[idParam];
        if (!resourceId) {
          throw new Error(`Resource ID not found in request params: ${idParam}`);
        }
        
        // Find the resource to check relationship
        const Model = mongoose.model(modelName);
        const resourceObj = await Model.findOne({ _id: resourceId });
        
        if (!resourceObj) {
          throw new Error(`${resource} not found`);
        }
        
        // Check relationship with custom function if provided
        let hasRelationship = false;
        
        if (typeof relationshipCheck === 'function') {
          hasRelationship = await relationshipCheck(req.user, resourceObj);
        } else if (relationshipField) {
          // Default relationship check based on matching fields
          const userRelValue = req.user[relationshipField];
          const resourceRelValue = resourceObj[relationshipField];
          
          hasRelationship = userRelValue && resourceRelValue && 
            userRelValue.toString() === resourceRelValue.toString();
        }
        
        if (hasRelationship) {
          // Check permission with relationship context
          const hasPermission = await permissionService.checkPermission(
            req.user, resource, action, { hasRelationship: true }
          );
          
          if (hasPermission) {
            return next();
          }
        }
        
        throw new AuthorizationError(`You don't have permission to ${action} this ${resource}`);
      } catch (error) {
        next(error);
      }
    });
  },
  
  /**
   * Dynamic permission checker for complex scenarios
   * @param {Function} permissionResolver - Async function that resolves permission context
   * @returns {Function} - Express middleware
   */
  dynamicPermission: (permissionResolver) => {
    return asyncHandler(async (req, res, next) => {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }
      
      try {
        // Resolve permission requirements dynamically
        const { resource, action, context } = await permissionResolver(req);
        
        if (!resource || !action) {
          throw new Error('Resource and action must be returned from permission resolver');
        }
        
        const hasPermission = await permissionService.checkPermission(
          req.user, resource, action, context || {}
        );
        
        if (hasPermission) {
          return next();
        }
        
        throw new AuthorizationError(
          `You don't have permission to perform this operation`
        );
      } catch (error) {
        next(error);
      }
    });
  },

  /**
   * Factory for creating custom permission middlewares
   * @param {Function} checker - Custom permission check function
   * @returns {Function} - Express middleware
   */
  custom: (checker) => {
    return asyncHandler(async (req, res, next) => {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }
      
      try {
        const result = await checker(req, req.user);
        
        if (result === true) {
          return next();
        }
        
        // If result is a string, use it as error message
        const message = typeof result === 'string' 
          ? result 
          : 'Permission denied';
          
        throw new AuthorizationError(message);
      } catch (error) {
        next(error);
      }
    });
  }
};

module.exports = rbacMiddleware;

// src/utils/permission-decorators.js
const rbacMiddleware = require('../middleware/rbac.middleware');

/**
 * Utility for creating permission decorators for route handlers
 */
const PermissionDecorators = {
  /**
   * Create a permission checker decorator
   * @param {string} resource - Resource type
   * @param {string} action - Action type
   * @returns {Function} - Express middleware
   */
  requirePermission: (resource, action, options = {}) => {
    return rbacMiddleware.requirePermission(resource, action, options);
  },

  /**
   * Create an ownership-based permission decorator
   * @param {Object} options - Configuration options
   * @returns {Function} - Express middleware
   */
  requireOwnership: (options) => {
    return rbacMiddleware.requireOwnership(options);
  },

  /**
   * Create a role level decorator
   * @param {number} level - Minimum role level
   * @returns {Function} - Express middleware
   */
  requireLevel: (level) => {
    return rbacMiddleware.requireLevel(level);
  },
  
  /**
   * Create a hierarchical relationship decorator
   * @param {Object} options - Configuration options
   * @returns {Function} - Express middleware
   */
  requireHierarchical: (options) => {
    return rbacMiddleware.requireHierarchical(options);
  },
  
  /**
   * Create a dynamic permission decorator
   * @param {Function} resolver - Permission resolver function
   * @returns {Function} - Express middleware
   */
  dynamicPermission: (resolver) => {
    return rbacMiddleware.dynamicPermission(resolver);
  }
};

module.exports = PermissionDecorators;
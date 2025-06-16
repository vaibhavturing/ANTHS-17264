const { ResponseUtil } = require('../utils/response.util');
const logger = require('../utils/logger');

/**
 * Authorization middleware
 * Handles role-based access control
 */
const authorizationMiddleware = {
  /**
   * Authorize user based on roles
   * @param {Array|String} allowedRoles - Roles that have access
   * @returns {Function} Express middleware function
   */
  authorize: (allowedRoles) => {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return ResponseUtil.error(res, 'User not authenticated', 401, 'UNAUTHORIZED');
        }
        
        // Convert to array if single role provided
        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
        
        // Check if user has one of the legacy roles
        const hasLegacyRole = roles.includes(req.user.role);
        
        // Check if user has one of the required roles from the roles array
        const hasRole = req.user.roles && req.user.roles.some(role => 
          roles.includes(role.name)
        );
        
        if (hasLegacyRole || hasRole) {
          return next();
        }
        
        logger.warn('Authorization failed: insufficient permissions', {
          userId: req.user.userId,
          requiredRoles: roles,
          userRoles: req.user.roles ? req.user.roles.map(r => r.name) : [],
          legacyRole: req.user.role
        });
        
        return ResponseUtil.error(
          res, 
          'Access denied: insufficient permissions', 
          403, 
          'FORBIDDEN'
        );
      } catch (error) {
        logger.error('Authorization error', { error: error.message });
        return ResponseUtil.error(res, 'Authorization error', 500, 'SERVER_ERROR');
      }
    };
  }
};

module.exports = authorizationMiddleware;
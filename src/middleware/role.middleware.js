// src/middleware/role.middleware.js

/**
 * Middleware to check if user has required roles
 * @param {Array} allowedRoles - Array of role names that have access
 * @returns {Function} Express middleware function
 */
const roleMiddleware = (allowedRoles = []) => {
  // FIXED: Return an explicitly defined middleware function
  return function roleMiddlewareFunction(req, res, next) {
    try {
      // User should already be authenticated and attached to req by auth.middleware
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user role is in the allowed roles list
      if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
      }

      // If we reach here, user has permission
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Role verification failed'
      });
    }
  };
};

module.exports = roleMiddleware;
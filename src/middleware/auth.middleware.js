const { User, ROLES } = require('../models/user.model');
const { getTokenFromRequest, verifyToken } = require('../utils/auth.util');
const { 
  UnauthorizedError, 
  ForbiddenError, 
  BadRequestError 
} = require('../utils/api-error.util');
const logger = require('../utils/logger');
const { StatusCodes } = require('http-status-codes');

/**
 * Middleware to protect routes - requires authentication
 */
const protect = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return next(new UnauthorizedError('You are not logged in. Please log in to get access.'));
    }
    const decoded = await verifyToken(token);
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    if (!user) {
      return next(new UnauthorizedError('The user with this token no longer exists.'));
    }
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return next(new UnauthorizedError('Your password was recently changed. Please log in again.'));
    }
    if (user.accountLocked) {
      const message = user.lockedUntil && user.lockedUntil > new Date()
        ? `Your account is locked. Please try again after ${user.lockedUntil.toLocaleString()}.`
        : 'Your account is locked. Please contact an administrator.';
      return next(new UnauthorizedError(message));
    }
    if (!user.isActive) {
      return next(new UnauthorizedError('Your account is inactive. Please contact an administrator.'));
    }
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() }, { new: true, runValidators: false });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Permission-based authentication middleware
 * @param {string} permission - Permission string to check (e.g., 'view:patients')
 * @returns {Function} Express middleware
 */
const auth = (permission) => {
  return async (req, res, next) => {
    // First, ensure user is authenticated
    await protect(req, res, async (err) => {
      if (err) return next(err);

      // If no permission required, just continue
      if (!permission) return next();

      // Example: check if user has the permission (customize as needed)
      // You might store permissions in req.user.permissions (array of strings)
      if (req.user && Array.isArray(req.user.permissions)) {
        if (req.user.permissions.includes(permission)) {
          return next();
        }
      }

      // Fallback: allow admins, or deny
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      return next(new ForbiddenError('You do not have permission to perform this action'));
    });
  };
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new Error('restrictTo middleware used without protect middleware'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError('You do not have permission to perform this action')
      );
    }
    next();
  };
};

const requireHIPAATraining = () => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new Error('requireHIPAATraining middleware used without protect middleware'));
    }
    const needsTraining = [
      ROLES.ADMIN, 
      ROLES.DOCTOR, 
      ROLES.NURSE,
      ROLES.RECEPTIONIST,
      ROLES.BILLING,
      ROLES.LAB_TECHNICIAN
    ].includes(req.user.role);
    if (needsTraining && !req.user.hipaaTrainingCompleted) {
      return next(
        new ForbiddenError('You must complete HIPAA training before accessing this resource')
      );
    }
    next();
  };
};

const logAccess = () => {
  return (req, res, next) => {
    if (req.user) {
      const accessLog = {
        user: req.user._id,
        method: req.method,
        path: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
      };
      logger.info('Access log', accessLog);
    }
    next();
  };
};

const extractUser = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return next();
    }
    try {
      const decoded = await verifyToken(token);
      const user = await User.findById(decoded.id);
      if (user && user.isActive && !user.accountLocked) {
        req.user = user;
      }
    } catch (error) {
      // Ignore token errors, just continue without user
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
  restrictTo,
  requireHIPAATraining,
  logAccess,
  extractUser,
  auth // <-- Export the new auth middleware
};
/**
 * Healthcare Management Application
 * Authentication Middleware
 * 
 * Middleware functions for protecting routes, extracting user information,
 * and handling authentication errors
 */

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
 * @returns {Function} Express middleware
 */
const protect = async (req, res, next) => {
  try {
    // 1. Get token from request
    const token = getTokenFromRequest(req);
    
    if (!token) {
      return next(new UnauthorizedError('You are not logged in. Please log in to get access.'));
    }

    // 2. Verify token
    const decoded = await verifyToken(token);

    // 3. Check if user still exists
    const user = await User.findById(decoded.id).select('+passwordChangedAt');
    
    if (!user) {
      return next(new UnauthorizedError('The user with this token no longer exists.'));
    }

    // 4. Check if user changed password after token was issued
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return next(new UnauthorizedError('Your password was recently changed. Please log in again.'));
    }

    // 5. Check if account is locked
    if (user.accountLocked) {
      const message = user.lockedUntil && user.lockedUntil > new Date()
        ? `Your account is locked. Please try again after ${user.lockedUntil.toLocaleString()}.`
        : 'Your account is locked. Please contact an administrator.';
      
      return next(new UnauthorizedError(message));
    }

    // 6. Check if account is active
    if (!user.isActive) {
      return next(new UnauthorizedError('Your account is inactive. Please contact an administrator.'));
    }

    // 7. Update last login time
    await User.findByIdAndUpdate(user._id, { 
      lastLogin: new Date() 
    }, { 
      new: true,
      runValidators: false
    });

    // 8. Grant access - store user object in request for future use
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to restrict access based on user roles
 * @param  {...String} roles - Roles that are allowed to access the route
 * @returns {Function} Express middleware
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if protect middleware has been run before this
    if (!req.user) {
      return next(new Error('restrictTo middleware used without protect middleware'));
    }
    
    // Check if user role is included in the allowed roles
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          'You do not have permission to perform this action'
        )
      );
    }
    
    next();
  };
};

/**
 * Middleware to ensure HIPAA training is complete for medical staff
 * @returns {Function} Express middleware
 */
const requireHIPAATraining = () => {
  return (req, res, next) => {
    // Check if protect middleware has been run before this
    if (!req.user) {
      return next(new Error('requireHIPAATraining middleware used without protect middleware'));
    }
    
    // Only applicable for staff that need HIPAA training
    const needsTraining = [
      ROLES.ADMIN, 
      ROLES.DOCTOR, 
      ROLES.NURSE,
      ROLES.RECEPTIONIST,
      ROLES.BILLING,
      ROLES.LAB_TECHNICIAN
    ].includes(req.user.role);
    
    // If training is needed but not completed
    if (needsTraining && !req.user.hipaaTrainingCompleted) {
      return next(
        new ForbiddenError(
          'You must complete HIPAA training before accessing this resource'
        )
      );
    }
    
    next();
  };
};

/**
 * Middleware to log all authenticated access for HIPAA compliance
 * @returns {Function} Express middleware
 */
const logAccess = () => {
  return (req, res, next) => {
    // Only log if user is authenticated
    if (req.user) {
      const accessLog = {
        user: req.user._id,
        method: req.method,
        path: req.originalUrl,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
      };
      
      // Log to a secure location for HIPAA compliance
      logger.info('Access log', accessLog);
      
      // Could also save access logs to the database for audit trails
      // This would be implemented here
    }
    
    next();
  };
};

/**
 * Optional middleware to extract user from token but not require authentication
 * Useful for routes that work differently for logged-in vs anonymous users
 * @returns {Function} Express middleware
 */
const extractUser = async (req, res, next) => {
  try {
    // Get token from request
    const token = getTokenFromRequest(req);
    
    // If no token or invalid token, just continue without user
    if (!token) {
      return next();
    }
    
    try {
      // Verify token
      const decoded = await verifyToken(token);
      
      // Find user
      const user = await User.findById(decoded.id);
      
      // If user exists and is active, attach to request
      if (user && user.isActive && !user.accountLocked) {
        req.user = user;
      }
    } catch (error) {
      // Just continue without user on token error
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
  extractUser
};
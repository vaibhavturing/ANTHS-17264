const { User, ROLES } = require("../models/user.model");
const { getTokenFromRequest, verifyToken } = require("../utils/auth.util");
const { UnauthorizedError, ForbiddenError, BadRequestError } = require("../utils/api-error.util");
const logger = require("../utils/logger");
const { StatusCodes } = require("http-status-codes");

/**
 * Middleware to protect routes - requires authentication
 */
const protect = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return next(new UnauthorizedError("You are not logged in. Please log in to get access."));
    }

    const decoded = await verifyToken(token);
    const user = await User.findById(decoded.id).select("+passwordChangedAt");

    if (!user) {
      return next(new UnauthorizedError("The user with this token no longer exists."));
    }

    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return next(new UnauthorizedError("Your password was recently changed. Please log in again."));
    }

    if (user.accountLocked) {
      const message = user.lockedUntil && user.lockedUntil > new Date() ? `Your account is locked. Please try again after ${user.lockedUntil.toLocaleString()}.` : "Your account is locked. Please contact an administrator.";
      return next(new UnauthorizedError(message));
    }

    if (!user.isActive) {
      return next(new UnauthorizedError("Your account is inactive. Please contact an administrator."));
    }

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() }, { new: true, runValidators: false });
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Permission-based middleware
 */
const auth = permission => {
  return async (req, res, next) => {
    await protect(req, res, async err => {
      if (err) return next(err);

      if (!permission) return next();

      if (req.user && Array.isArray(req.user.permissions)) {
        if (req.user.permissions.includes(permission)) {
          return next();
        }
      }

      if (req.user && req.user.role === "admin") {
        return next();
      }

      return next(new ForbiddenError("You do not have permission to perform this action"));
    });
  };
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new Error("restrictTo middleware used without protect middleware"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError("You do not have permission to perform this action"));
    }
    next();
  };
};

const requireHIPAATraining = () => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new Error("requireHIPAATraining middleware used without protect middleware"));
    }
    const needsTraining = [ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.BILLING, ROLES.LAB_TECHNICIAN].includes(req.user.role);
    if (needsTraining && !req.user.hipaaTrainingCompleted) {
      return next(new ForbiddenError("You must complete HIPAA training before accessing this resource"));
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
        userAgent: req.headers["user-agent"],
        timestamp: new Date()
      };
      logger.info("Access log", accessLog);
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
      // Ignore token errors, continue without user
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to require a specific role
 */
const requireRole = role => {
  return [protect, restrictTo(role)];
};

/**
 * Middleware to require any one of several roles
 */
const requireAnyRole = roles => {
  return [
    protect,
    (req, res, next) => {
      if (!req.user) {
        return next(new UnauthorizedError("Not authenticated"));
      }
      if (!roles.includes(req.user.role)) {
        return next(new ForbiddenError("You do not have permission to perform this action"));
      }
      next();
    }
  ];
};

/**
 * Middleware to require self (matching user ID) or a specific role
 */
const requireSelfOrRole = (role, paramKey = "id") => {
  return [
    protect,
    (req, res, next) => {
      const isSelf = req.user && req.user._id.toString() === req.params[paramKey];
      const isAdmin = req.user && req.user.role === role;
      if (isSelf || isAdmin) {
        return next();
      }
      return next(new ForbiddenError("Access denied"));
    }
  ];
};

/**
 * Middleware to require self only
 */
const requireSelf = (paramKey = "id") => {
  return [
    protect,
    (req, res, next) => {
      const isSelf = req.user && req.user._id.toString() === req.params[paramKey];
      if (isSelf) {
        return next();
      }
      return next(new ForbiddenError("Access denied"));
    }
  ];
};

module.exports = {
  protect,
  restrictTo,
  requireHIPAATraining,
  logAccess,
  extractUser,
  auth,
  requireRole,
  requireAnyRole,
  requireSelfOrRole,
  requireSelf
};

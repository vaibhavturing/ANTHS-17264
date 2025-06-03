const { User, ROLES } = require("../models/user.model");
const { verifyAccessToken, extractTokenFromRequest } = require('../utils/jwt.util');
const { UnauthorizedError, ForbiddenError, BadRequestError } = require("../utils/api-error.util");
const logger = require("../utils/logger");
const { StatusCodes } = require("http-status-codes");

/**
 * Authentication middleware
 * Verifies the access token and attaches the user to the request
 */
const protect = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) {
      return next(new UnauthorizedError("You are not logged in. Please log in to get access."));
    }

    const decoded = await verifyAccessToken(token);
    const user = await User.findById(decoded.sub || decoded.id).select("+passwordChangedAt");

    if (!user) {
      return next(new UnauthorizedError("The user with this token no longer exists."));
    }

    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return next(new UnauthorizedError("Your password was recently changed. Please log in again."));
    }

    if (user.accountLocked) {
      const message = user.lockedUntil && user.lockedUntil > new Date()
        ? `Your account is locked. Please try again after ${user.lockedUntil.toLocaleString()}.`
        : "Your account is locked. Please contact an administrator.";
      return next(new UnauthorizedError(message));
    }

    if (!user.isActive) {
      return next(new UnauthorizedError("Your account is inactive. Please contact an administrator."));
    }

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() }, { new: true, runValidators: false });
    req.user = user;
    req.userRole = user.role;
    req.userId = user._id;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware
 * @param {...String} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.userRole) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to access this resource' });
    }

    next();
  };
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
        if (req.user.permissions.includes(permission)) return next();
      }

      if (req.user && req.user.role === "admin") return next();

      return next(new ForbiddenError("You do not have permission to perform this action"));
    });
  };
};

/**
 * Middleware to restrict roles
 */
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

/**
 * Check if user has completed HIPAA training
 */
const requireHIPAATraining = () => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new Error("requireHIPAATraining middleware used without protect middleware"));
    }
    const needsTraining = [
      ROLES.ADMIN, ROLES.DOCTOR, ROLES.NURSE,
      ROLES.RECEPTIONIST, ROLES.BILLING, ROLES.LAB_TECHNICIAN
    ].includes(req.user.role);
    if (needsTraining && !req.user.hipaaTrainingCompleted) {
      return next(new ForbiddenError("You must complete HIPAA training before accessing this resource"));
    }
    next();
  };
};

/**
 * Log access for auditing
 */
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

/**
 * Extract user from token if present (used for optional authentication)
 */
const extractUser = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);
    if (!token) return next();

    try {
      const decoded = await verifyAccessToken(token);
      const user = await User.findById(decoded.sub || decoded.id);
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
 * Patient record access check
 */
const canAccessPatientRecords = async (req, res, next) => {
  try {
    if (req.userRole === 'admin') return next();

    const patientId = req.params.patientId || req.body.patientId;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }

    if (req.userRole === 'patient' && req.userId.toString() !== patientId) {
      return res.status(403).json({ success: false, message: 'You can only access your own medical records' });
    }

    if (['doctor', 'nurse'].includes(req.userRole)) {
      // TODO: Replace with actual logic to verify patient belongs to the same department
      const isAuthorized = true; // ← implement real check here
      if (!isAuthorized) {
        return res.status(403).json({ success: false, message: 'You do not have permission to access this patient\'s records' });
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error checking patient access permissions' });
  }
};

/**
 * Utility middlewares
 */
const requireRole = role => [protect, restrictTo(role)];

const requireAnyRole = roles => [
  protect,
  (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError("Not authenticated"));
    if (!roles.includes(req.user.role)) return next(new ForbiddenError("You do not have permission to perform this action"));
    next();
  }
];

const requireSelfOrRole = (role, paramKey = "id") => [
  protect,
  (req, res, next) => {
    const isSelf = req.user && req.user._id.toString() === req.params[paramKey];
    const isAdmin = req.user && req.user.role === role;
    if (isSelf || isAdmin) return next();
    return next(new ForbiddenError("Access denied"));
  }
];

const requireSelf = (paramKey = "id") => [
  protect,
  (req, res, next) => {
    const isSelf = req.user && req.user._id.toString() === req.params[paramKey];
    if (isSelf) return next();
    return next(new ForbiddenError("Access denied"));
  }
];

const requirePatientSelfOrProvider = (paramKey = "id") => [
  protect,
  (req, res, next) => {
    const isSelf = req.user && req.user._id.toString() === req.params[paramKey];
    const isProvider = ["doctor", "nurse", "admin"].includes(req.user?.role);
    if (isSelf || isProvider) return next();
    return next(new ForbiddenError("Access denied"));
  }
];

const requirePatientSelf = (paramKey = "id") => [
  protect,
  (req, res, next) => {
    const isSelf = req.user && req.user.role === "patient" && req.user._id.toString() === req.params[paramKey];
    const isAdmin = req.user && req.user.role === "admin";
    if (isSelf || isAdmin) return next();
    return next(new ForbiddenError("Access denied"));
  }
];

const requireRecordCreatorOrAdmin = (getRecordById, paramKey = "id") => [
  protect,
  async (req, res, next) => {
    try {
      const recordId = req.params[paramKey];
      const record = await getRecordById(recordId);

      if (!record) return next(new BadRequestError("Record not found"));

      const isCreator = record.createdBy?.toString() === req.user._id.toString();
      const isAdmin = req.user.role === "admin";

      if (isCreator || isAdmin) return next();

      return next(new ForbiddenError("You are not authorized to access this record"));
    } catch (err) {
      next(err);
    }
  }
];

module.exports = {
  protect,
  authenticate: protect, // alias for backward compatibility
  restrictTo,
  requireHIPAATraining,
  logAccess,
  extractUser,
  authorize,
  canAccessPatientRecords,
  auth,
  requireRole,
  requireAnyRole,
  requireSelfOrRole,
  requireSelf,
  requirePatientSelfOrProvider,
  requirePatientSelf,
  requireRecordCreatorOrAdmin
};

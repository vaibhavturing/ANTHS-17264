/**
 * Authorization middleware for role-based access control
 */
const { ResponseUtil } = require('../utils/response.util');
const logger = require('../utils/logger');

/**
 * Middleware to check if the user has the required role
 * @param {Array|string} roles - Allowed role(s) for the route
 * @returns {Function} Express middleware function
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    // Ensure user exists in request (auth middleware should have set this)
    if (!req.user) {
      logger.warn('Authorization middleware called without user in request');
      return ResponseUtil.error(
        res, 
        'Authentication required', 
        401, 
        'UNAUTHORIZED'
      );
    }

    // Convert roles to array if it's a string
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    // Check if user has one of the required roles
    if (allowedRoles.includes(req.user.role)) {
      return next(); // User has permission
    }

    // Additional check for role objects in the roles array if it exists
    if (req.user.roles && Array.isArray(req.user.roles)) {
      for (const userRole of req.user.roles) {
        // Check if the role object has a name property and it matches
        if (userRole.name && allowedRoles.includes(userRole.name)) {
          return next(); // User has permission
        }
      }
    }

    // Log unauthorized access attempt
    logger.warn('Unauthorized access attempt', {
      userId: req.user._id,
      userRole: req.user.role,
      requiredRoles: allowedRoles,
      path: req.originalUrl
    });

    // Return forbidden error
    return ResponseUtil.error(
      res,
      'You do not have permission to perform this action',
      403,
      'FORBIDDEN'
    );
  };
};

/**
 * Middleware to check if the user has access to the patient data
 * @param {string} paramName - Request parameter name that contains the patientId
 * @returns {Function} Express middleware function
 */
const checkPatientAccess = (paramName = 'patientId') => {
  return async (req, res, next) => {
    try {
      const patientId = req.params[paramName];
      
      if (!patientId) {
        return ResponseUtil.error(
          res,
          `Parameter '${paramName}' is missing`,
          400,
          'BAD_REQUEST'
        );
      }

      // Admins and doctors have access to all patient data
      if (['admin', 'doctor'].includes(req.user.role)) {
        return next();
      }

      // Patients can only access their own data
      if (req.user.role === 'patient') {
        // Check if the patient has a patientProfile property linking to their profile
        if (req.user.patientProfile && req.user.patientProfile.toString() === patientId) {
          return next();
        }
      }

      // Nurses have access based on assigned departments/doctors
      if (req.user.role === 'nurse') {
        // In a real application, you would check if the nurse is assigned to the patient's doctor
        // This is a simplified example
        
        // Example: Check if patient belongs to nurse's assigned doctors
        // const Patient = require('../models/patient.model');
        // const patient = await Patient.findById(patientId);
        // if (patient && req.user.assignedDoctors.includes(patient.doctor.toString())) {
        //   return next();
        // }

        // For demo purposes, we'll allow nurses access
        // In production, implement proper access control
        return next();
      }

      logger.warn('Unauthorized patient data access attempt', {
        userId: req.user._id,
        userRole: req.user.role,
        patientId,
        path: req.originalUrl
      });

      return ResponseUtil.error(
        res,
        'You do not have permission to access this patient data',
        403,
        'FORBIDDEN'
      );
    } catch (error) {
      logger.error('Error in patient access middleware', { error: error.message });
      return ResponseUtil.error(
        res,
        'Error checking patient access permissions',
        500,
        'SERVER_ERROR'
      );
    }
  };
};

/**
 * Middleware to check if the user owns the resource or is an admin
 * @param {string} modelName - The mongoose model name
 * @param {string} paramName - Request parameter name that contains the resourceId
 * @param {string} ownerField - Field name in the model that represents the owner
 * @returns {Function} Express middleware function
 */
const checkResourceOwnership = (modelName, paramName = 'id', ownerField = 'createdBy') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      
      if (!resourceId) {
        return ResponseUtil.error(
          res,
          `Parameter '${paramName}' is missing`,
          400,
          'BAD_REQUEST'
        );
      }

      // Admin has access to all resources
      if (req.user.role === 'admin') {
        return next();
      }

      // Load the model dynamically
      const Model = require(`../models/${modelName}.model`);
      const resource = await Model.findById(resourceId);
      
      if (!resource) {
        return ResponseUtil.error(
          res,
          'Resource not found',
          404,
          'NOT_FOUND'
        );
      }

      // Check if the user is the owner of the resource
      if (resource[ownerField] && resource[ownerField].toString() === req.user._id.toString()) {
        return next();
      }

      logger.warn('Unauthorized resource access attempt', {
        userId: req.user._id,
        userRole: req.user.role,
        resourceId,
        path: req.originalUrl
      });

      return ResponseUtil.error(
        res,
        'You do not have permission to access this resource',
        403,
        'FORBIDDEN'
      );
    } catch (error) {
      logger.error('Error in resource ownership middleware', { error: error.message });
      return ResponseUtil.error(
        res,
        'Error checking resource ownership permissions',
        500,
        'SERVER_ERROR'
      );
    }
  };
};

module.exports = {
  checkRole,
  checkPatientAccess,
  checkResourceOwnership
};
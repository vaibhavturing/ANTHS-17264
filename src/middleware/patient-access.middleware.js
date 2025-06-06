// src/middleware/patient-access.middleware.js

const { Patient } = require('../models/patient.model');
const { AuthorizationError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware for handling patient data access control
 */
const patientAccessMiddleware = {
  /**
   * Check if the user has access to a patient's data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  checkPatientAccess: async (req, res, next) => {
    try {
      const patientId = req.params.patientId;
      const userId = req.user._id;
      
      // Get the patient
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Admins always have access
      if (req.user.roles.some(role => role.name === 'admin')) {
        return next();
      }
      
      // Medical providers (doctors, nurses) have access to their patients
      if (req.user.roles.some(role => ['doctor', 'nurse'].includes(role.name))) {
        return next();
      }
      
      // Patients only have access to their own data
      if (
        req.user.roles.some(role => role.name === 'patient') && 
        patient.user && 
        patient.user.toString() === userId.toString()
      ) {
        return next();
      }
      
      // If all checks fail, deny access
      logger.warn('Unauthorized access attempt to patient data', {
        userId: userId.toString(),
        patientId: patientId
      });
      
      throw new AuthorizationError('You do not have permission to access this patient\'s data');
    } catch (error) {
      next(error);
    }
  }
};

module.exports = patientAccessMiddleware;
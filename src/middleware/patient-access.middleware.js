// src/middleware/patient-access.middleware.js

const mongoose = require('mongoose');
const { AuthorizationError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

// Get the patient model - ensuring we use proper model access
const getPatientModel = () => {
  try {
    return mongoose.model('Patient');
  } catch (error) {
    return require('../models/patient.model').Patient;
  }
};

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
      
      const Patient = getPatientModel();
      
      // Get the patient
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Admins always have access
      const isAdmin = (req.user.roles && req.user.roles.some(role => role.name === 'admin')) || 
                     req.user.role === 'admin';
      if (isAdmin) {
        return next();
      }
      
      // Medical providers (doctors, nurses) have access to their patients
      const isProvider = (req.user.roles && req.user.roles.some(role => ['doctor', 'nurse'].includes(role.name))) || 
                        ['doctor', 'nurse'].includes(req.user.role);
      if (isProvider) {
        return next();
      }
      
      // Patients only have access to their own data
      const isPatient = (req.user.roles && req.user.roles.some(role => role.name === 'patient')) || 
                       req.user.role === 'patient';
                       
      const patientIsUser = patient.user && patient.user.toString() === userId.toString();
      
      if (isPatient && patientIsUser) {
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
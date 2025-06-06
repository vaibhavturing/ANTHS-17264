// src/middleware/medical-record-access.middleware.js

const { MedicalRecord } = require('../models/medicalRecord.model');
const { AuthorizationError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Middleware for handling medical record access control
 */
const medicalRecordAccessMiddleware = {
  /**
   * Check if the user has the required access level to a medical record
   * @param {string} requiredLevel - Required access level (read, write, admin)
   * @returns {Function} Express middleware
   */
  checkRecordAccess: (requiredLevel = 'read') => {
    return async (req, res, next) => {
      try {
        const recordId = req.params.recordId;
        const userId = req.user._id;
        
        // Get the medical record
        const medicalRecord = await MedicalRecord.findById(recordId);
        
        if (!medicalRecord || medicalRecord.isDeleted) {
          throw new NotFoundError('Medical record not found');
        }
        
        // Admins always have access
        if (req.user.roles && req.user.roles.some(role => role.name === 'admin')) {
          return next();
        }
        
        // For back-compatibility, also check the role string
        if (req.user.role === 'admin') {
          return next();
        }
        
        // Medical providers (doctors, nurses) have access to records they created
        const isProvider = (req.user.roles && req.user.roles.some(role => ['doctor', 'nurse'].includes(role.name))) ||
                          ['doctor', 'nurse'].includes(req.user.role);
                          
        if (isProvider && medicalRecord.provider.toString() === userId.toString()) {
          return next();
        }
        
        // Patients have access to their own records
        const isPatient = (req.user.roles && req.user.roles.some(role => role.name === 'patient')) ||
                         req.user.role === 'patient';
                         
        if (isPatient && medicalRecord.patient.toString() === userId.toString()) {
          // If patient, they only have read access
          if (requiredLevel === 'read') {
            return next();
          } else {
            throw new AuthorizationError('Patients can only view their medical records');
          }
        }
        
        // Check explicit access grants
        if (medicalRecord.hasAccess && medicalRecord.hasAccess(userId, requiredLevel)) {
          return next();
        }
        
        // If all checks fail, deny access
        logger.warn('Unauthorized access attempt to medical record', {
          userId: userId.toString(),
          recordId: recordId,
          requiredLevel
        });
        
        throw new AuthorizationError(`You do not have ${requiredLevel} access to this medical record`);
      } catch (error) {
        next(error);
      }
    };
  }
};

module.exports = medicalRecordAccessMiddleware;
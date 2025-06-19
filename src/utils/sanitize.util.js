// src/utils/sanitize.util.js
// HIPAA Data Sanitization Utility
// NEW FILE: Ensures only the minimum necessary PHI is returned

const logger = require('./logger');

/**
 * HIPAA Data Sanitization Utility
 * Implements the "minimum necessary" principle by filtering
 * response data based on user role and permissions.
 */
const sanitizeUtil = {
  /**
   * Sanitize an object or array of objects based on allowed fields
   * @param {Object|Array} data - The data to sanitize
   * @param {Object} options - Sanitization options
   * @param {string[]} options.allowedFields - Fields to include
   * @param {boolean} options.allowAllFields - Whether to allow all fields
   * @returns {Object|Array} Sanitized data
   */
  sanitizeData: (data, options = {}) => {
    // If data is null or undefined, return as is
    if (data === null || data === undefined) {
      return data;
    }
    
    // Default options
    const opts = {
      allowedFields: ['_id', 'id'], // Always include IDs
      allowAllFields: false,
      ...options
    };
    
    // If allow all fields, return data as is
    if (opts.allowAllFields) {
      return data;
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => sanitizeUtil.sanitizeData(item, opts));
    }
    
    // Handle objects
    if (typeof data === 'object' && data !== null) {
      const sanitized = {};
      
      // Process each field
      for (const field of opts.allowedFields) {
        // Handle nested fields (e.g., "user.name")
        if (field.includes('.')) {
          const [parentField, ...childFields] = field.split('.');
          const childPath = childFields.join('.');
          
          // Create nested object if parent field exists in data
          if (data[parentField] !== undefined) {
            sanitized[parentField] = sanitized[parentField] || {};
            
            // If parent is an object, sanitize nested field
            if (typeof data[parentField] === 'object' && data[parentField] !== null) {
              const nestedValue = sanitizeUtil.sanitizeData(
                data[parentField], 
                { 
                  allowedFields: [childPath],
                  allowAllFields: opts.allowAllFields
                }
              );
              
              // Merge nested results
              sanitized[parentField] = {
                ...sanitized[parentField],
                ...nestedValue
              };
            }
          }
        } 
        // Handle normal fields
        else if (data[field] !== undefined) {
          sanitized[field] = data[field];
        }
      }
      
      return sanitized;
    }
    
    // For primitive value, return as is
    return data;
  },
  
  /**
   * HIPAA: Sanitize patient data based on user role
   * @param {Object} patient - Patient object
   * @param {Object} user - User accessing the data
   * @param {Object} options - Additional options
   * @returns {Object} Sanitized patient data
   */
  sanitizePatientData: (patient, user, options = {}) => {
    if (!patient) return null;
    if (!user) return { id: patient._id || patient.id }; // Return only ID if no user
    
    // Options for different roles
    const roleOptions = {
      patient: {
        allowedFields: [
          '_id', 'id', 'firstName', 'lastName', 'dateOfBirth', 
          'contactInformation', 'emergencyContact', 'hipaaConsent'
        ]
      },
      doctor: {
        allowedFields: [
          '_id', 'id', 'firstName', 'lastName', 'dateOfBirth', 'gender',
          'contactInformation', 'emergencyContact', 'medicalInformation',
          'hipaaConsent'
        ]
      },
      nurse: {
        allowedFields: [
          '_id', 'id', 'firstName', 'lastName', 'dateOfBirth', 'gender',
          'contactInformation.phoneNumber', 'contactInformation.email',
          'medicalInformation.allergies', 'medicalInformation.bloodType',
          'emergencyContact'
        ]
      },
      admin: {
        allowAllFields: true
      }
    };
    
    // If user is the patient accessing their own data
    if (user.role === 'patient' && patient._id && user._id && 
       (patient._id.toString() === user._id.toString() || 
        (patient.userId && patient.userId.toString() === user._id.toString()))) {
      return sanitizeUtil.sanitizeData(patient, {
        ...roleOptions.patient,
        allowedFields: [
          ...roleOptions.patient.allowedFields,
          'insuranceInformation'
        ]
      });
    }
    
    // Get options for user role
    const userRole = user.role || 'patient';
    const sanitizationOptions = roleOptions[userRole] || roleOptions.patient;
    
    // Apply break-glass context if present
    if (options.breakGlassAccess) {
      // For emergency access, more fields may be available
      // but we still need to log this special access
      logger.warn('Break-glass patient data access', {
        userId: user._id,
        patientId: patient._id,
        reason: options.breakGlassAccess.reason,
        timestamp: options.breakGlassAccess.timestamp
      });
      
      // Add special flag to indicate this was accessed via break-glass
      const sanitized = sanitizeUtil.sanitizeData(patient, {
        ...roleOptions.doctor, // Use doctor level access for emergencies
        allowedFields: [
          ...roleOptions.doctor.allowedFields,
          'insuranceInformation'
        ]
      });
      
      // Add flag indicating emergency access
      sanitized._emergencyAccess = true;
      return sanitized;
    }
    
    // Normal access - sanitize based on role
    return sanitizeUtil.sanitizeData(patient, sanitizationOptions);
  },
  
  /**
   * HIPAA: Sanitize medical record data based on user role
   * @param {Object} record - Medical record object
   * @param {Object} user - User accessing the data
   * @param {Object} options - Additional options
   * @returns {Object} Sanitized record data
   */
  sanitizeMedicalRecord: (record, user, options = {}) => {
    if (!record) return null;
    if (!user) return { id: record._id || record.id }; // Return only ID if no user
    
    // Options for different roles
    const roleOptions = {
      patient: {
        allowedFields: [
          '_id', 'id', 'recordType', 'date', 'doctorId', 'patientId', 
          'summary', 'attachments'
        ]
      },
      doctor: {
        allowAllFields: true
      },
      nurse: {
        allowedFields: [
          '_id', 'id', 'recordType', 'date', 'doctorId', 'patientId',
          'summary', 'vitalSigns', 'diagnosis', 'symptoms', 'attachments'
        ]
      },
      admin: {
        allowAllFields: true
      }
    };
    
    // Record type-specific restrictions for patients
    if (user.role === 'patient') {
      const recordType = record.recordType || record.type || 'unknown';
      
      const sensitiveTypes = ['psychiatric', 'hiv', 'substance_abuse', 'genetic'];
      
      // Special handling for some record types that patients may 
      // not have full access to (legal & ethical restrictions)
      if (sensitiveTypes.includes(recordType.toLowerCase())) {
        // For sensitive records, patients only see basic info unless explicitly allowed
        // This may vary by local regulations/policies
        return sanitizeUtil.sanitizeData(record, {
          allowedFields: ['_id', 'id', 'recordType', 'date', 'doctorId', 'patientId']
        });
      }
    }
    
    // Get options for user role
    const userRole = user.role || 'patient';
    const sanitizationOptions = roleOptions[userRole] || roleOptions.patient;
    
    // Apply break-glass context if present
    if (options.breakGlassAccess) {
      logger.warn('Break-glass medical record access', {
        userId: user._id,
        recordId: record._id,
        reason: options.breakGlassAccess.reason,
        timestamp: options.breakGlassAccess.timestamp
      });
      
      const sanitized = sanitizeUtil.sanitizeData(record, {
        allowAllFields: true // Full access in emergency situations
      });
      
      // Add flag indicating emergency access
      sanitized._emergencyAccess = true;
      return sanitized;
    }
    
    // Normal access
    return sanitizeUtil.sanitizeData(record, sanitizationOptions);
  }
};

module.exports = sanitizeUtil;
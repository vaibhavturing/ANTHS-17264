// src/utils/transform.util.js

/**
 * Utilities for transforming data for API responses
 * Provides functions for sanitizing, formatting, and transforming data
 */

const mongoose = require('mongoose');
const { AuthorizationError } = require('./errors');

/**
 * Configuration for sensitive fields that should be removed from responses
 */
const SENSITIVE_FIELDS = {
  // User-related fields
  password: true,
  passwordHash: true,
  salt: true,
  tokens: true,
  refreshToken: true,
  passwordResetToken: true,
  passwordResetExpires: true,
  emailVerificationToken: true,
  failedLoginAttempts: true,
  
  // Healthcare-specific sensitive fields
  ssn: true,
  socialSecurityNumber: true,
  insurancePolicyNumber: true,
  medicalRecordNumber: true,
  
  // API and system fields
  __v: true
};

/**
 * Transform Mongoose document or object for API response
 * @param {Object|Array} data - Data to transform
 * @param {Object} options - Transformation options
 * @returns {Object|Array} Transformed data
 */
function transformResponse(data, options = {}) {
  // Set default options
  const opts = {
    removeSensitiveFields: true,
    includeVirtuals: true,
    formatDates: true,
    maxDepth: 3,
    ...options
  };
  
  // Handle null/undefined values
  if (data == null) {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => transformResponse(item, { ...opts, maxDepth: opts.maxDepth - 1 }));
  }
  
  // Handle Mongoose documents
  if (data instanceof mongoose.Document) {
    // Convert to plain object with virtuals
    const object = data.toObject ? 
      data.toObject({ virtuals: opts.includeVirtuals }) : 
      { ...data };
    
    return transformObject(object, opts);
  }
  
  // Handle plain objects
  if (data && typeof data === 'object' && !Buffer.isBuffer(data)) {
    return transformObject(data, opts);
  }
  
  // Return primitive values unchanged
  return data;
}

/**
 * Transform a plain object
 * @param {Object} obj - Object to transform
 * @param {Object} options - Transformation options
 * @returns {Object} Transformed object
 */
function transformObject(obj, options) {
  // Stop at maximum recursion depth
  if (options.maxDepth <= 0) {
    return obj;
  }
  
  const result = {};
  
  // Process each field
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields
    if (options.removeSensitiveFields && SENSITIVE_FIELDS[key]) {
      continue;
    }
    
    // Handle sub-objects and arrays recursively with decreased depth
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        result[key] = value.map(item => {
          if (item && typeof item === 'object') {
            return transformResponse(item, { ...options, maxDepth: options.maxDepth - 1 });
          }
          return item;
        });
      } else if (value instanceof Date) {
        // Format dates
        result[key] = options.formatDates ? formatDate(value) : value;
      } else if (mongoose.Types.ObjectId.isValid(value)) {
        // Convert ObjectId to string
        result[key] = value.toString();
      } else {
        // Recursively transform object
        result[key] = transformResponse(value, { ...options, maxDepth: options.maxDepth - 1 });
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Format date objects consistently
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  if (!date) return null;
  return date.toISOString();
}

/**
 * Remove fields from object based on user permissions
 * @param {Object} data - Object to filter
 * @param {Object} user - User object with roles and permissions
 * @param {Object} permissionConfig - Configuration for field permissions
 * @returns {Object} Filtered object
 */
function applyFieldPermissions(data, user, permissionConfig) {
  // If no permission config, return data unchanged
  if (!permissionConfig || !user) {
    return data;
  }
  
  // Handle null/undefined values
  if (data == null) {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => applyFieldPermissions(item, user, permissionConfig));
  }
  
  const result = { ...data };
  const userRoles = user.roles || [];
  
  // Check field permissions
  for (const [field, permissions] of Object.entries(permissionConfig)) {
    // Field exists in data and has permission config
    if (field in result) {
      const allowedRoles = permissions.roles || [];
      const isPublic = permissions.public || false;
      
      // Check if field is accessible
      const hasPermission = isPublic || 
        userRoles.some(role => allowedRoles.includes(role)) ||
        (permissions.owner && user._id && result.createdBy && 
         user._id.toString() === result.createdBy.toString());
        
      if (!hasPermission) {
        // Remove field if user doesn't have permission
        delete result[field];
      } else if (permissions.subFields && result[field] && typeof result[field] === 'object') {
        // If field has sub-permissions and is an object
        result[field] = applyFieldPermissions(result[field], user, permissions.subFields);
      }
    }
  }
  
  return result;
}

/**
 * Apply HIPAA-specific data transformations and protection
 * @param {Object} data - Medical data to transform
 * @param {Object} user - User accessing the data
 * @param {Object} options - HIPAA options
 * @returns {Object} HIPAA-compliant data
 */
function applyHIPAAProtection(data, user, options = {}) {
  // If no data or no user, return null to be safe
  if (!data || !user) {
    throw new AuthorizationError('Access denied due to HIPAA compliance requirements');
  }
  
  // Check if user has HIPAA authorization
  const hasHIPAAAuthorization = user.hipaaAuthorized || user.roles.includes('admin');
  if (!hasHIPAAAuthorization && !options.skipAuthCheck) {
    throw new AuthorizationError.hipaaViolation();
  }
  
  // Create object for protected health information (PHI)
  const result = transformResponse(data);
  
  // If user can only access de-identified data
  if (!hasHIPAAAuthorization && options.allowDeidentified) {
    // Remove personal identifiers according to HIPAA Safe Harbor method
    return deidentifyPHI(result);
  }
  
  // Add audit trail for PHI access if enabled
  if (options.audit && options.auditService) {
    options.auditService.logAccess({
      userId: user._id,
      dataType: options.dataType || 'patient',
      dataId: data._id,
      action: options.action || 'view',
      timestamp: new Date()
    });
  }
  
  return result;
}

/**
 * De-identify protected health information using HIPAA Safe Harbor method
 * @param {Object} data - PHI data
 * @returns {Object} De-identified data
 */
function deidentifyPHI(data) {
  // Fields to completely remove
  const fieldBlacklist = [
    'name', 'email', 'address', 'phone', 'ssn', 'dateOfBirth', 'fullName',
    'socialSecurityNumber', 'phoneNumber', 'mobileNumber', 'streetAddress',
    'city', 'zipCode', 'postalCode', 'medicalRecordNumber', 'healthPlanId',
    'accountNumber', 'licenseNumber', 'vehicleId', 'deviceId', 'biometricData',
    'faxNumber', 'emailAddress', 'photoUrl', 'profileImage'
  ];
  
  // Make a copy for modification
  const result = { ...data };
  
  // Remove blacklisted fields
  fieldBlacklist.forEach(field => {
    delete result[field];
  });
  
  // Modify age (if present)
  if (result.age && result.age > 89) {
    result.age = '90+';
  }
  
  // Generalize dates to year only if present
  if (result.birthDate) {
    result.birthYear = new Date(result.birthDate).getFullYear();
    delete result.birthDate;
  }
  
  // Handle geo data - truncate to just 3-digit ZIP
  if (result.zip) {
    result.zip = result.zip.substring(0, 3);
  }
  
  return result;
}

/**
 * Format money values consistently
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted money value
 */
function formatMoney(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Format phone numbers consistently
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // US format: (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  }
  
  // International format with US country code: +1 (XXX) XXX-XXXX
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7, 11)}`;
  }
  
  // Return original if not matching expected patterns
  return phone;
}

module.exports = {
  transformResponse,
  applyFieldPermissions,
  applyHIPAAProtection,
  deidentifyPHI,
  formatMoney,
  formatPhoneNumber
};
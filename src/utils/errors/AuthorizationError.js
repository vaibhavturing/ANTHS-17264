// src/utils/errors/AuthorizationError.js

const BaseError = require('./BaseError');
const { StatusCodes } = require('http-status-codes');

/**
 * Error for authorization failures
 * @extends BaseError
 */
class AuthorizationError extends BaseError {
  /**
   * Create authorization error
   * @param {string} message - Error message
   * @param {*} details - Error details
   * @param {string} code - Error code
   */
  constructor(
    message = 'You do not have permission to perform this action',
    details = undefined,
    code = 'PERMISSION_DENIED'
  ) {
    super(
      'AuthorizationError',
      StatusCodes.FORBIDDEN,
      message,
      true,
      code,
      details
    );
  }
  
  /**
   * Insufficient permissions error
   * @param {string} resource - Resource being accessed
   * @param {string} action - Action being attempted
   * @returns {AuthorizationError}
   */
  static insufficientPermissions(resource, action) {
    return new AuthorizationError(
      `You do not have permission to ${action} this ${resource}`,
      { resource, action },
      'INSUFFICIENT_PERMISSIONS'
    );
  }
  
  /**
   * Resource ownership error
   * @param {string} resource - Resource being accessed
   * @returns {AuthorizationError}
   */
  static notResourceOwner(resource) {
    return new AuthorizationError(
      `You do not have permission to access this ${resource}`,
      { resource },
      'NOT_RESOURCE_OWNER'
    );
  }
  
  /**
   * Role permission error
   * @param {string|string[]} requiredRoles - Required roles
   * @returns {AuthorizationError}
   */
  static roleRequired(requiredRoles) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    const rolesText = roles.join(' or ');
    
    return new AuthorizationError(
      `This action requires ${rolesText} role`,
      { requiredRoles: roles },
      'ROLE_REQUIRED'
    );
  }
  
  /**
   * Error for attempting to access PHI without proper clearance
   * @returns {AuthorizationError}
   */
  static hipaaViolation() {
    return new AuthorizationError(
      'Access to this protected health information is not authorized',
      undefined,
      'HIPAA_VIOLATION'
    );
  }
  
  /**
   * Error for missing patient consent
   * @returns {AuthorizationError}
   */
  static consentRequired() {
    return new AuthorizationError(
      'Patient consent is required for this operation',
      undefined,
      'CONSENT_REQUIRED'
    );
  }
}

module.exports = AuthorizationError;
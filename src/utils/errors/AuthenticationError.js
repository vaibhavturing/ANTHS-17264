// src/utils/errors/AuthenticationError.js

const BaseError = require('./BaseError');
const { StatusCodes } = require('http-status-codes');

/**
 * Error for authentication failures
 * @extends BaseError
 */
class AuthenticationError extends BaseError {
  /**
   * Create authentication error
   * @param {string} message - Error message
   * @param {*} details - Error details
   * @param {string} code - Error code
   */
  constructor(
    message = 'Authentication failed',
    details = undefined,
    code = 'AUTHENTICATION_FAILED'
  ) {
    super(
      'AuthenticationError',
      StatusCodes.UNAUTHORIZED,
      message,
      true,
      code,
      details
    );
  }
  
  /**
   * Invalid credentials error
   * @returns {AuthenticationError}
   */
  static invalidCredentials() {
    return new AuthenticationError(
      'Invalid email or password',
      undefined,
      'INVALID_CREDENTIALS'
    );
  }
  
  /**
   * Missing token error
   * @returns {AuthenticationError}
   */
  static missingToken() {
    return new AuthenticationError(
      'Authentication token is required',
      undefined,
      'MISSING_TOKEN'
    );
  }
  
  /**
   * Invalid token error
   * @param {string} reason - Reason for token being invalid
   * @returns {AuthenticationError}
   */
  static invalidToken(reason = 'Token is invalid or expired') {
    return new AuthenticationError(
      reason,
      undefined,
      'INVALID_TOKEN'
    );
  }
  
  /**
   * Account locked error
   * @param {number} minutesLocked - Minutes until unlock
   * @returns {AuthenticationError}
   */
  static accountLocked(minutesLocked = 30) {
    return new AuthenticationError(
      `Account temporarily locked due to too many failed attempts. Please try again in ${minutesLocked} minutes`,
      { minutesLocked },
      'ACCOUNT_LOCKED'
    );
  }
  
  /**
   * Account not verified error
   * @returns {AuthenticationError}
   */
  static accountNotVerified() {
    return new AuthenticationError(
      'Email address has not been verified',
      undefined,
      'ACCOUNT_NOT_VERIFIED'
    );
  }
  
  /**
   * HIPAA training required error
   * @returns {AuthenticationError}
   */
  static hipaaTrainingRequired() {
    return new AuthenticationError(
      'HIPAA training certification is required to access this resource',
      undefined,
      'HIPAA_TRAINING_REQUIRED'
    );
  }
}

module.exports = AuthenticationError;
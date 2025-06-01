// src/utils/errors/BusinessLogicError.js

const BaseError = require('./BaseError');
const { StatusCodes } = require('http-status-codes');

/**
 * Error for business logic violations
 * @extends BaseError
 */
class BusinessLogicError extends BaseError {
  /**
   * Create business logic error
   * @param {string} message - Error message
   * @param {*} details - Error details
   * @param {string} code - Error code
   */
  constructor(
    message = 'Business logic violation',
    details = undefined,
    code = 'BUSINESS_LOGIC_ERROR'
  ) {
    super(
      'BusinessLogicError',
      StatusCodes.UNPROCESSABLE_ENTITY,
      message,
      true,
      code,
      details
    );
  }
  
  /**
   * Create scheduling conflict error
   * @param {Date} conflictTime - Time of conflict
   * @param {string} reason - Reason for conflict
   * @returns {BusinessLogicError}
   */
  static schedulingConflict(conflictTime, reason) {
    return new BusinessLogicError(
      'Scheduling conflict detected',
      { conflictTime, reason },
      'SCHEDULING_CONFLICT'
    );
  }
  
  /**
   * Create error for invalid status transitions
   * @param {string} currentStatus - Current status
   * @param {string} targetStatus - Target status
   * @returns {BusinessLogicError}
   */
  static invalidStatusTransition(currentStatus, targetStatus) {
    return new BusinessLogicError(
      `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
      { currentStatus, targetStatus },
      'INVALID_STATUS_TRANSITION'
    );
  }
  
  /**
   * Create error for invalid operation
   * @param {string} operation - Operation being attempted
   * @param {string} reason - Reason operation is invalid
   * @returns {BusinessLogicError}
   */
  static invalidOperation(operation, reason) {
    return new BusinessLogicError(
      `Cannot perform operation: ${reason}`,
      { operation, reason },
      'INVALID_OPERATION'
    );
  }
  
  /**
   * Create error for medication conflicts
   * @param {string[]} medications - Conflicting medications
   * @returns {BusinessLogicError}
   */
  static medicationConflict(medications) {
    return new BusinessLogicError(
      'Medication conflict detected',
      { conflictingMedications: medications },
      'MEDICATION_CONFLICT'
    );
  }
}

module.exports = BusinessLogicError;
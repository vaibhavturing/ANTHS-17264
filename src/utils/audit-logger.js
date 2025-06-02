/**
 * Audit Logger Module
 * Provides HIPAA-compliant audit logging for security and compliance events
 * Maintains immutable records of all data access and modifications
 */

const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('../config/config');

// Define audit log directory
const auditLogDir = path.join(process.cwd(), 'logs', 'audit');

// Ensure audit log directory exists
if (!fs.existsSync(auditLogDir)) {
  fs.mkdirSync(auditLogDir, { recursive: true });
}

// Create formatter for audit logs
const auditFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.json()
);

// Create the audit logger
const auditLogger = createLogger({
  level: 'info',
  format: auditFormat,
  defaultMeta: { 
    service: 'healthcare-app-audit',
    environment: config.env
  },
  transports: [
    // Store audit logs separately in their own files
    new DailyRotateFile({
      level: 'info',
      dirname: auditLogDir,
      filename: 'audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '365d', // Keep audit logs for a year
      format: auditFormat,
      zippedArchive: true
    }),
    // Also log to console in development
    ...(config.env === 'development' ? [
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          format.printf(info => {
            const { timestamp, level, message, ...rest } = info;
            return `${timestamp} ${level} [AUDIT]: ${message} ${JSON.stringify(rest)}`;
          })
        )
      })
    ] : [])
  ],
  exitOnError: false
});

/**
 * Log a data access event
 * @param {Object} options - Audit log details
 * @param {string} options.userId - ID of user performing the action
 * @param {string} options.action - Type of action (e.g., 'read', 'view')
 * @param {string} options.resourceType - Type of resource being accessed (e.g., 'patient', 'medicalRecord')
 * @param {string} options.resourceId - ID of the resource being accessed
 * @param {Object} options.metadata - Additional metadata about the access
 */
const logDataAccess = ({ userId, action, resourceType, resourceId, metadata = {} }) => {
  auditLogger.info('Data Access', {
    eventType: 'DATA_ACCESS',
    userId,
    action,
    resourceType,
    resourceId,
    timestamp: new Date().toISOString(),
    metadata
  });
};

/**
 * Log a data modification event
 * @param {Object} options - Audit log details
 * @param {string} options.userId - ID of user performing the action
 * @param {string} options.action - Type of action (e.g., 'create', 'update', 'delete')
 * @param {string} options.resourceType - Type of resource being modified
 * @param {string} options.resourceId - ID of the resource being modified
 * @param {Object} options.changes - Description of changes made
 * @param {Object} options.metadata - Additional metadata about the modification
 */
const logDataModification = ({ userId, action, resourceType, resourceId, changes, metadata = {} }) => {
  auditLogger.info('Data Modification', {
    eventType: 'DATA_MODIFICATION',
    userId,
    action,
    resourceType,
    resourceId,
    changes,
    timestamp: new Date().toISOString(),
    metadata
  });
};

/**
 * Log an authentication event
 * @param {Object} options - Audit log details
 * @param {string} options.userId - ID of user (if available)
 * @param {string} options.action - Type of action (e.g., 'login', 'logout', 'failed_login')
 * @param {string} options.ipAddress - IP address of the request
 * @param {string} options.userAgent - User agent of the request
 * @param {Object} options.metadata - Additional metadata about the authentication
 */
const logAuthentication = ({ userId, action, ipAddress, userAgent, metadata = {} }) => {
  auditLogger.info('Authentication', {
    eventType: 'AUTHENTICATION',
    userId: userId || 'anonymous',
    action,
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString(),
    metadata
  });
};

/**
 * Log a security event
 * @param {Object} options - Audit log details
 * @param {string} options.userId - ID of user (if available)
 * @param {string} options.action - Type of action (e.g., 'permission_denied', 'invalid_token')
 * @param {string} options.resourceType - Type of resource involved (if applicable)
 * @param {string} options.resourceId - ID of the resource involved (if applicable)
 * @param {string} options.ipAddress - IP address of the request
 * @param {Object} options.metadata - Additional metadata about the security event
 */
const logSecurity = ({ userId, action, resourceType, resourceId, ipAddress, metadata = {} }) => {
  auditLogger.info('Security', {
    eventType: 'SECURITY',
    userId: userId || 'anonymous',
    action,
    resourceType,
    resourceId,
    ipAddress,
    timestamp: new Date().toISOString(),
    metadata
  });
};

/**
 * Log a PHI disclosure event (for HIPAA compliance)
 * @param {Object} options - Audit log details
 * @param {string} options.userId - ID of user performing the disclosure
 * @param {string} options.patientId - ID of the patient whose PHI was disclosed
 * @param {string} options.recipientType - Type of recipient (e.g., 'provider', 'patient', 'insurance')
 * @param {string} options.recipientId - ID of the recipient
 * @param {string} options.purpose - Purpose of disclosure
 * @param {string} options.informationType - Type of information disclosed
 * @param {Object} options.metadata - Additional metadata about the disclosure
 */
const logPhiDisclosure = ({ userId, patientId, recipientType, recipientId, purpose, informationType, metadata = {} }) => {
  auditLogger.info('PHI Disclosure', {
    eventType: 'PHI_DISCLOSURE',
    userId,
    patientId,
    recipientType,
    recipientId,
    purpose,
    informationType,
    timestamp: new Date().toISOString(),
    metadata
  });
};

module.exports = {
  logDataAccess,
  logDataModification,
  logAuthentication,
  logSecurity,
  logPhiDisclosure
};
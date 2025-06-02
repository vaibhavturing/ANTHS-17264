/**
 * Logger Configuration Module
 * Manages Winston logger configuration with environment-specific settings
 * Implements log rotation, structured logging, and HIPAA-compliant features
 */

const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('./config');

// Define log directory
const logDir = path.join(process.cwd(), 'logs');

// Custom format for sanitizing sensitive information
const sanitizeFormat = format((info) => {
  // Create a deep copy of the log info
  const sanitizedInfo = { ...info };
  
  // Fields that might contain PHI to be sanitized
  const sensitiveFields = ['ssn', 'patient_id', 'email', 'address', 'phone', 'dob', 'mrn', 'insurance_id'];
  
  // Replace sensitive fields if present
  if (typeof sanitizedInfo.message === 'object') {
    const message = { ...sanitizedInfo.message };
    
    sensitiveFields.forEach(field => {
      if (message[field]) {
        // Replace all but last 4 characters with asterisks
        const value = message[field].toString();
        if (value.length > 4) {
          message[field] = '****' + value.substring(value.length - 4);
        } else {
          message[field] = '********';
        }
      }
    });
    
    sanitizedInfo.message = message;
  }
  
  return sanitizedInfo;
});

// Create formatter for structured logs
const structuredFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  sanitizeFormat(),
  format.json()
);

// Create formatter for console logs
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(info => {
    const { timestamp, level, message, correlationId, ...rest } = info;
    // Include stack trace if available
    const stackInfo = rest.stack ? `\n${rest.stack}` : '';
    // Include correlation ID for request tracing
    const reqId = correlationId ? ` [${correlationId}]` : '';
    // Format message based on type
    const formattedMessage = typeof message === 'object' ? 
      JSON.stringify(message, null, 2) : message;
    
    return `${timestamp} ${level}${reqId}: ${formattedMessage}${stackInfo}`;
  })
);

// Create file transport for rotated logs
const createFileRotateTransport = (level) => {
  return new DailyRotateFile({
    level,
    dirname: logDir,
    filename: `${level}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep logs for 14 days
    format: structuredFormat,
    zippedArchive: true
  });
};

// Create logger with transports based on environment
const createLoggerWithTransports = () => {
  // Define log level based on environment
  const level = config.env === 'development' ? 'debug' : 'info';
  
  // Define transports array
  const logTransports = [
    // Always create console transport for all environments
    new transports.Console({
      level,
      format: consoleFormat
    })
  ];
  
  // Add file transports for production and staging environments
  if (config.env !== 'development' && config.env !== 'test') {
    // Create separate file transport for each log level
    logTransports.push(createFileRotateTransport('error'));
    logTransports.push(createFileRotateTransport('warn'));
    logTransports.push(createFileRotateTransport('info'));
    
    // Only add debug logs in staging environment
    if (config.env === 'staging') {
      logTransports.push(createFileRotateTransport('debug'));
    }
  }
  
  return createLogger({
    level,
    defaultMeta: { 
      service: 'healthcare-app',
      environment: config.env
    },
    transports: logTransports,
    // Do not exit on error
    exitOnError: false
  });
};

// Export the configured logger
module.exports = createLoggerWithTransports();
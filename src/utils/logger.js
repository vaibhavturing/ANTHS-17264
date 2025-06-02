/**
 * Logger Utility Module
 * Provides unified logging interface for the application
 * Supports log levels, correlation IDs, and sanitized logging
 */

const logger = require('../config/logger.config');
const os = require('os');

// Store hostname for log context
const hostname = os.hostname();

// Track request context using async local storage
let requestContext = { correlationId: null };

/**
 * Set correlation ID for request context
 * @param {string} id - Correlation ID to identify related log entries
 */
const setCorrelationId = (id) => {
  requestContext.correlationId = id;
};

/**
 * Get current correlation ID
 * @returns {string|null} Current correlation ID
 */
const getCorrelationId = () => {
  return requestContext.correlationId;
};

/**
 * Format log message with context information
 * @param {*} message - Log message
 * @param {Object} [meta={}] - Additional metadata to include
 * @returns {Object} Formatted message with context
 */
const formatMessage = (message, meta = {}) => {
  return {
    ...meta,
    correlationId: requestContext.correlationId,
    hostname,
    message
  };
};

/**
 * Log an error message
 * @param {*} message - Error message or Error object
 * @param {Object} [meta={}] - Additional metadata
 */
const error = (message, meta = {}) => {
  // If message is an Error object, extract message and stack
  if (message instanceof Error) {
    logger.error(formatMessage(message.message, {
      ...meta,
      stack: message.stack
    }));
  } else {
    logger.error(formatMessage(message, meta));
  }
};

/**
 * Log a warning message
 * @param {*} message - Warning message
 * @param {Object} [meta={}] - Additional metadata
 */
const warn = (message, meta = {}) => {
  logger.warn(formatMessage(message, meta));
};

/**
 * Log an info message
 * @param {*} message - Info message
 * @param {Object} [meta={}] - Additional metadata
 */
const info = (message, meta = {}) => {
  logger.info(formatMessage(message, meta));
};

/**
 * Log a debug message
 * @param {*} message - Debug message
 * @param {Object} [meta={}] - Additional metadata
 */
const debug = (message, meta = {}) => {
  logger.debug(formatMessage(message, meta));
};

/**
 * Log application startup information
 */
const logStartup = () => {
  info('Application starting', {
    nodeEnv: process.env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
    pid: process.pid
  });
};

/**
 * Create a middleware that adds correlation ID to request context
 * @returns {Function} Express middleware
 */
const requestLogger = () => {
  return (req, res, next) => {
    // Generate correlation ID if not present
    const correlationId = req.headers['x-correlation-id'] || 
      req.headers['x-request-id'] || 
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set correlation ID for this request
    setCorrelationId(correlationId);
    
    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationId);
    
    // Add correlation ID to request object for use in routes
    req.correlationId = correlationId;
    
    // Log request information
    debug(`Incoming request: ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: correlationId
    });
    
    // Log response time when request completes
    const startTime = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      const logLevel = res.statusCode >= 500 ? 'error' : 
                      res.statusCode >= 400 ? 'warn' : 'info';
      
      logger[logLevel](formatMessage(`Request completed: ${req.method} ${req.originalUrl}`, {
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: correlationId
      }));
    });
    
    next();
  };
};

module.exports = {
  error,
  warn,
  info,
  debug,
  setCorrelationId,
  getCorrelationId,
  requestLogger,
  logStartup
};
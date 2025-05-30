/**
 * Healthcare Management Application
 * Morgan Request Logging Middleware
 * 
 * Configures Morgan HTTP request logger with different formats per environment
 * and integrates with Winston logger for consistent logging
 */

const morgan = require('morgan');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Create a custom Morgan token for additional request details
 */
morgan.token('user-id', (req) => {
  return req.user ? req.user.id : 'unauthenticated';
});

/**
 * Create a custom Morgan token for client IP address
 */
morgan.token('remote-addr', (req) => {
  // Get client IP considering potential proxies
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? 
    forwarded.split(',')[0].trim() : 
    req.socket.remoteAddress;
});

/**
 * Setup request logging with Morgan integrated with Winston
 * @returns {Function} Configured Morgan middleware
 */
const morganMiddleware = () => {
  // Skip logging for health check endpoints in production to reduce noise
  const skipHealthCheck = (req, res) => {
    return config.env === 'production' && req.url === '/health';
  };

  // Define different formats for different environments
  let format;

  if (config.env === 'production') {
    // Use concise format for production
    format = ':remote-addr - user :user-id :method :url :status :res[content-length] :response-time ms';
  } else if (config.env === 'development') {
    // Use more detailed format for development
    format = 'dev-verbose :remote-addr - user :user-id ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';
  } else {
    // Use standard format for test
    format = 'combined';
  }

  // Create a stream that writes to our Winston logger
  const stream = {
    write: (message) => {
      // Remove line breaks
      const log = message.replace(/\n$/, '');
      logger.http(log);
    },
  };

  return morgan(format, { 
    stream,
    skip: skipHealthCheck
  });
};

module.exports = morganMiddleware;
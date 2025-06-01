// src/middleware/ip-whitelist.middleware.js

/**
 * IP whitelist middleware for restricting sensitive operations
 * to approved IP addresses or IP ranges
 */

const ipRangeCheck = require('ip-range-check');
const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * IP whitelist middleware factory
 * @param {string[]} allowedIps - Array of allowed IPs or IP ranges
 * @returns {Function} Express middleware
 */
const createIpWhitelistMiddleware = (allowedIps = []) => {
  // Use provided IPs or configuration
  const whitelistedIps = allowedIps.length > 0 
    ? allowedIps 
    : (config.security?.ipWhitelist || []);
  
  // If no IPs configured and not in production, allow all
  const skipChecks = whitelistedIps.length === 0 && config.env !== 'production';
  
  return (req, res, next) => {
    // Skip checks if configured to do so
    if (skipChecks) {
      return next();
    }
    
    // Get client IP address
    const ip = req.ip || req.connection.remoteAddress;
    
    // Check if IP is in the allowed list
    const isAllowed = whitelistedIps.some(allowedIp => {
      // Check if it's a CIDR range
      if (allowedIp.includes('/')) {
        return ipRangeCheck(ip, allowedIp);
      }
      
      // Direct IP match
      return ip === allowedIp;
    });
    
    if (isAllowed) {
      return next();
    }
    
    // Log unauthorized access attempt
    logger.warn(`IP whitelist restriction: ${ip} attempted to access restricted route ${req.method} ${req.originalUrl}`);
    
    // Return authorization error
    return next(new AuthorizationError(
      'Access denied. Your IP address is not whitelisted for this operation.',
      { ip },
      'IP_NOT_WHITELISTED'
    ));
  };
};

/**
 * Middleware specifically for admin operations
 * Uses the admin IP whitelist from config
 */
const adminIpWhitelist = (req, res, next) => {
  const adminIps = config.security?.adminIpWhitelist || [];
  
  // Skip IP check in development if no admin IPs are configured
  if (adminIps.length === 0 && config.env === 'development') {
    return next();
  }
  
  const ip = req.ip || req.connection.remoteAddress;
  const isAllowed = adminIps.some(allowedIp => {
    if (allowedIp.includes('/')) {
      return ipRangeCheck(ip, allowedIp);
    }
    return ip === allowedIp;
  });
  
  if (isAllowed) {
    return next();
  }
  
  // Log unauthorized admin access attempt
  logger.warn(`Admin IP restriction: ${ip} attempted to access admin route ${req.method} ${req.originalUrl}`, {
    userId: req.user?.id,
    userRole: req.user?.role
  });
  
  return next(new AuthorizationError(
    'Administrative access denied. Your IP address is not authorized.',
    { ip },
    'ADMIN_IP_RESTRICTED'
  ));
};

module.exports = {
  createIpWhitelistMiddleware,
  adminIpWhitelist
};
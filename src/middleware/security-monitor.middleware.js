/**
 * Security Monitoring Middleware
 * File: src/middleware/security-monitor.middleware.js
 * 
 * Middleware for monitoring security-related events and suspicious activities
 */
const logger = require('../utils/logger');
const SecurityEvent = require('../models/securityEvent.model');
const ipRangeCheck = require('ip-range-check');
const requestIp = require('request-ip');
const config = require('../config/config');

/**
 * Middleware to detect and log suspicious activities
 */
const securityMonitorMiddleware = async (req, res, next) => {
  try {
    // Get client IP
    const clientIp = requestIp.getClientIp(req);
    
    // Check if request contains suspicious patterns
    const suspiciousPatterns = [
      /union\s+select/i,
      /<script>/i,
      /alert\s*\(/i,
      /exec\s*\(/i,
      /eval\s*\(/i,
      /document\.cookie/i,
      /\.\.\/\.\.\/\.\.\/\.\.\/\.\.\//,
    ];
    
    // Convert request query and body to string for pattern matching
    const queryString = JSON.stringify(req.query);
    const bodyString = JSON.stringify(req.body);
    const urlString = req.originalUrl;
    
    // Flag to track if request is suspicious
    let isSuspicious = false;
    let matchedPattern = null;
    
    // Check for suspicious patterns
    for (const pattern of suspiciousPatterns) {
      if (
        pattern.test(queryString) || 
        pattern.test(bodyString) || 
        pattern.test(urlString)
      ) {
        isSuspicious = true;
        matchedPattern = pattern.toString();
        break;
      }
    }
    
    // External suspicious IP check (would be implemented with actual threat intelligence in production)
    const isSuspiciousIP = false; // Replace with actual threat intel check
    
    // If suspicious, log security event
    if (isSuspicious || isSuspiciousIP) {
      const securityEvent = new SecurityEvent({
        eventType: 'suspicious_request',
        source: {
          ip: clientIp,
          userAgent: req.headers['user-agent'] || 'unknown'
        },
        request: {
          method: req.method,
          path: req.originalUrl,
          query: req.query,
          body: req.body, // Consider sanitizing sensitive data
          headers: req.headers // Consider sanitizing sensitive headers
        },
        severity: isSuspicious ? 'high' : 'medium',
        details: {
          reason: isSuspicious ? `Matched pattern: ${matchedPattern}` : 'Suspicious IP',
          timestamp: new Date()
        }
      });
      
      await securityEvent.save();
      
      logger.warn(`Security event detected: ${securityEvent.details.reason} from IP ${clientIp}`);
      
      // If configured to block suspicious requests, do that here
      if (config.security && config.security.blockSuspiciousRequests) {
        return res.status(403).json({
          status: 'error',
          message: 'Request blocked due to security concerns'
        });
      }
    }
    
    // Continue to next middleware
    next();
  } catch (error) {
    // Log error but continue to next middleware
    logger.error(`Error in security monitor middleware: ${error.message}`);
    next();
  }
};

module.exports = securityMonitorMiddleware;
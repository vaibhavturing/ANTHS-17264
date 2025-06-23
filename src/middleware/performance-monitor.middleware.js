/**
 * Performance Monitoring Middleware
 * Tracks response times and other performance metrics for API requests
 */

const metricsService = require('../services/metrics.service');
const logger = require('../utils/logger');
const monitoringConfig = require('../config/monitoring.config');

/**
 * Performance monitoring middleware
 */
const performanceMonitorMiddleware = (req, res, next) => {
  // Skip monitoring for static assets and health checks
  if (
    req.path.startsWith('/assets') ||
    req.path.startsWith('/public') || 
    req.path === '/metrics' ||
    req.path.startsWith('/api/health')
  ) {
    return next();
  }
  
  // Record start time
  const startTime = process.hrtime();
  
  // Keep track of response size
  let responseSize = 0;
  const originalWrite = res.write;
  const originalEnd = res.end;
  
  // Override write to track response size
  res.write = function(chunk, encoding) {
    responseSize += chunk.length;
    originalWrite.apply(res, arguments);
  };
  
  // Override end to capture duration and record metrics
  res.end = function(chunk, encoding) {
    // Calculate duration
    const hrDuration = process.hrtime(startTime);
    const durationMs = (hrDuration[0] * 1000) + (hrDuration[1] / 1000000);
    
    // Count final chunk size
    if (chunk) {
      responseSize += chunk.length;
    }
    
    // Call original end function
    originalEnd.apply(res, arguments);
    
    // Record response time in metrics service
    metricsService.recordHttpRequest(
      req.method,
      req.originalUrl || req.url,
      res.statusCode,
      durationMs
    );
    
    // Log request if it's slow
    if (durationMs > monitoringConfig.thresholds.responseTime.warning) {
      logger.warn(
        `Slow request: ${req.method} ${req.originalUrl || req.url} - ${durationMs.toFixed(2)}ms`,
        {
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          responseSize,
          duration: durationMs,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      );
    }
    
    // Debug logging for all requests if enabled
    if (process.env.DEBUG_PERFORMANCE === 'true') {
      const logLevel = durationMs > monitoringConfig.thresholds.responseTime.warning 
        ? 'warn' 
        : 'debug';
        
      logger[logLevel](
        `${req.method} ${req.originalUrl || req.url} - ${durationMs.toFixed(2)}ms - ${responseSize} bytes`,
        {
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          responseSize,
          duration: durationMs
        }
      );
    }
  };
  
  next();
};

module.exports = performanceMonitorMiddleware;
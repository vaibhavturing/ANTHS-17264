// src/middleware/performance.middleware.js
const newrelic = require('newrelic');
const logger = require('../utils/logger');

/**
 * Middleware that tracks API response times and sends data to New Relic
 */
function performanceMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Add response tracking
  const originalEnd = res.end;
  res.end = function() {
    const responseTime = Date.now() - startTime;
    const path = req.route ? req.route.path : req.path;
    
    // Add custom attributes to New Relic transaction
    newrelic.addCustomAttribute('responseTimeMs', responseTime);
    newrelic.addCustomAttribute('requestPath', path);
    newrelic.addCustomAttribute('requestMethod', req.method);
    
    // Log slow responses (over 1000ms)
    if (responseTime > 1000) {
      logger.warn(`Slow response detected: ${req.method} ${path} took ${responseTime}ms`);
    }
    
    // Call the original end method
    originalEnd.apply(this, arguments);
  };
  
  next();
}

module.exports = performanceMiddleware;
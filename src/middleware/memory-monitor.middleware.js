/**
 * Memory Monitoring Middleware
 * Monitors memory usage during API requests and logs potential memory leaks
 */

const memoryProfiler = require('../utils/memoryProfiler');
const logger = require('../utils/logger');

/**
 * Memory threshold in MB that triggers a warning
 * @type {number}
 */
const MEMORY_THRESHOLD_MB = 100;

/**
 * Middleware that monitors memory usage during API requests
 */
const memoryMonitorMiddleware = (req, res, next) => {
  // Skip monitoring for static assets
  if (req.path.startsWith('/public') || req.path.startsWith('/assets')) {
    return next();
  }
  
  // Record memory at start of request
  const startMemory = process.memoryUsage();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to capture memory usage when request completes
  res.end = function(...args) {
    // Call the original end function
    originalEnd.apply(res, args);
    
    // Calculate memory difference
    const endMemory = process.memoryUsage();
    const heapDiff = endMemory.heapUsed - startMemory.heapUsed;
    const heapDiffMB = heapDiff / (1024 * 1024);
    
    // Log memory usage for this request
    if (heapDiffMB > MEMORY_THRESHOLD_MB) {
      logger.warn(`Potential memory leak detected: ${req.method} ${req.originalUrl} - Memory change: ${heapDiffMB.toFixed(2)} MB`);
      
      // Take a snapshot for requests that increase memory significantly
      memoryProfiler.takeSnapshot(`memory-leak-${req.method}-${req.path.replace(/\//g, '-')}`);
    }
    
    // Log memory usage for debugging
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MEMORY === 'true') {
      logger.debug(`Memory usage - ${req.method} ${req.originalUrl}:`, {
        heapDiffMB: heapDiffMB.toFixed(2),
        totalHeapMB: (endMemory.heapUsed / (1024 * 1024)).toFixed(2)
      });
    }
  };
  
  next();
};

module.exports = memoryMonitorMiddleware;
// src/middleware/performance-monitor.middleware.js
// Performance monitoring middleware to track API response times and resource usage
// NEW FILE: Added for performance optimization

const logger = require('../utils/logger');
const { performance } = require('perf_hooks');
const os = require('os');

// Performance stats in memory
const stats = {
  requests: 0,
  responseTimes: [],
  errors: 0,
  requestsPerEndpoint: {},
  slowestEndpoints: {},
  lastReport: Date.now()
};

// Report interval in ms
const REPORT_INTERVAL = 60000; // 1 minute

// Generate performance report
function generateReport() {
  const now = Date.now();
  
  if (stats.responseTimes.length === 0) {
    return; // No data to report
  }
  
  // Calculate stats
  const avgResponseTime = stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length;
  const maxResponseTime = Math.max(...stats.responseTimes);
  const minResponseTime = Math.min(...stats.responseTimes);
  const p95ResponseTime = stats.responseTimes.sort((a, b) => a - b)[Math.floor(stats.responseTimes.length * 0.95)];
  
  // System resource usage
  const cpuUsage = os.loadavg()[0]; // 1 minute load average
  const memoryUsage = process.memoryUsage();
  const freeMem = os.freemem() / os.totalmem() * 100;
  
  // Top 5 slowest endpoints
  const slowestEndpoints = Object.entries(stats.slowestEndpoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([endpoint, time]) => `${endpoint}: ${time.toFixed(2)}ms`);
  
  // Log the report
  logger.info('Performance Report', {
    timeframe: `${new Date(stats.lastReport).toISOString()} to ${new Date(now).toISOString()}`,
    requests: stats.requests,
    errors: stats.errors,
    responseTimes: {
      avg: avgResponseTime.toFixed(2),
      min: minResponseTime.toFixed(2),
      max: maxResponseTime.toFixed(2),
      p95: p95ResponseTime.toFixed(2)
    },
    systemLoad: {
      cpu: cpuUsage.toFixed(2),
      memoryMB: (memoryUsage.rss / 1024 / 1024).toFixed(2),
      freeMemoryPercent: freeMem.toFixed(2)
    },
    slowestEndpoints
  });
  
  // Reset stats
  stats.requests = 0;
  stats.responseTimes = [];
  stats.errors = 0;
  stats.requestsPerEndpoint = {};
  stats.lastReport = now;
}

// Performance monitoring middleware
function performanceMonitor(req, res, next) {
  const startTime = performance.now();
  const url = req.originalUrl;
  
  // Track endpoint usage
  if (!stats.requestsPerEndpoint[url]) {
    stats.requestsPerEndpoint[url] = 0;
  }
  stats.requestsPerEndpoint[url]++;
  
  // Process the request and track performance
  res.on('finish', () => {
    const responseTime = performance.now() - startTime;
    stats.requests++;
    stats.responseTimes.push(responseTime);
    
    // Track errors
    if (res.statusCode >= 400) {
      stats.errors++;
    }
    
    // Track slowest endpoints
    if (!stats.slowestEndpoints[url] || stats.slowestEndpoints[url] < responseTime) {
      stats.slowestEndpoints[url] = responseTime;
    }
    
    // Log slow responses (over 500ms)
    if (responseTime > 500) {
      logger.warn(`Slow response: ${url} took ${responseTime.toFixed(2)}ms`, {
        method: req.method,
        statusCode: res.statusCode,
        responseTime: responseTime.toFixed(2)
      });
    }
    
    // Generate report if interval has passed
    if (Date.now() - stats.lastReport > REPORT_INTERVAL) {
      generateReport();
    }
  });
  
  next();
}

// Export middleware and utilities
module.exports = {
  performanceMonitor,
  generateReport,
  stats // Exported for testing purposes
};
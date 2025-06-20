/**
 * Application Metrics Middleware
 * 
 * This middleware collects performance metrics and exports them for monitoring systems.
 * It tracks API response times, error rates, and resource utilization.
 */

const promClient = require('prom-client');
const responseTime = require('response-time');
const logger = require('../utils/logger');

// Initialize the Prometheus registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const errorCounter = new promClient.Counter({
  name: 'app_error_count_total',
  help: 'Count of application errors',
  labelNames: ['errorType']
});

const activeUserGauge = new promClient.Gauge({
  name: 'app_active_users',
  help: 'Count of currently active users'
});

// Database operation metrics
const dbOperationDuration = new promClient.Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2]
});

// Register metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestCounter);
register.registerMetric(errorCounter);
register.registerMetric(activeUserGauge);
register.registerMetric(dbOperationDuration);

/**
 * Tracks HTTP request metrics
 */
const metricsMiddleware = responseTime((req, res, time) => {
  const route = req.route?.path || req.path;
  const statusCode = res.statusCode.toString();
  const method = req.method;
  
  // Record request duration
  httpRequestDurationMicroseconds
    .labels(method, route, statusCode)
    .observe(time / 1000); // Convert to seconds
    
  // Increment request counter
  httpRequestCounter
    .labels(method, route, statusCode)
    .inc();
    
  // Track 4xx and 5xx responses as errors
  if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
    errorCounter.labels('http_' + statusCode).inc();
  }
});

/**
 * Middleware to track active users
 */
const userTrackingMiddleware = (req, res, next) => {
  if (req.user) {
    activeUserGauge.inc();
    
    // Decrease gauge when the response finishes
    res.on('finish', () => {
      activeUserGauge.dec();
    });
  }
  next();
};

/**
 * Endpoint to expose metrics for Prometheus
 */
const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Error generating metrics', error);
    res.status(500).send('Error collecting metrics');
  }
};

/**
 * Track database operation performance
 * @param {string} operation - The database operation type (find, update, etc)
 * @param {string} collection - The database collection name
 * @param {function} callback - The database operation to perform
 * @returns {Promise<any>} - The result of the database operation
 */
const trackDbOperation = async (operation, collection, callback) => {
  const endTimer = dbOperationDuration.labels(operation, collection).startTimer();
  try {
    const result = await callback();
    endTimer();
    return result;
  } catch (error) {
    endTimer();
    errorCounter.labels('db_error').inc();
    throw error;
  }
};

/**
 * Record a specific application error
 * @param {string} errorType - Type of error
 */
const recordError = (errorType) => {
  errorCounter.labels(errorType).inc();
};

module.exports = {
  metricsMiddleware,
  userTrackingMiddleware,
  metricsEndpoint,
  trackDbOperation,
  recordError,
  register
};
/**
 * Metrics Service 
 * Collects, aggregates, and reports system and business metrics
 */

const os = require('os');
const mongoose = require('mongoose');
const prometheus = require('prom-client');
const monitoringConfig = require('../config/monitoring.config');
const redisClients = require('../config/redis.config');
const logger = require('../utils/logger');
const alertService = require('./alert.service');

// Get Redis client for metrics
const redisClient = redisClients.getCacheClient();

// Create Prometheus registry
const register = new prometheus.Registry();

// Define Prometheus metrics
const httpRequestDurationMicroseconds = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const cpuUsageGauge = new prometheus.Gauge({
  name: 'cpu_usage_percent',
  help: 'Current CPU usage percentage',
});

const memoryUsageGauge = new prometheus.Gauge({
  name: 'memory_usage_bytes',
  help: 'Current memory usage in bytes',
  labelNames: ['type'],
});

const databaseQueryDurationMicroseconds = new prometheus.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

const appointmentsBookedCounter = new prometheus.Counter({
  name: 'appointments_booked_total',
  help: 'Total number of appointments booked',
});

const patientRegistrationsCounter = new prometheus.Counter({
  name: 'patient_registrations_total',
  help: 'Total number of patient registrations',
});

const prescriptionsCreatedCounter = new prometheus.Counter({
  name: 'prescriptions_created_total',
  help: 'Total number of prescriptions created',
});

// Register all metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestTotal);
register.registerMetric(cpuUsageGauge);
register.registerMetric(memoryUsageGauge);
register.registerMetric(databaseQueryDurationMicroseconds);
register.registerMetric(appointmentsBookedCounter);
register.registerMetric(patientRegistrationsCounter);
register.registerMetric(prescriptionsCreatedCounter);

// Default metrics
prometheus.collectDefaultMetrics({ register });

/**
 * Metrics service 
 */
const metricsService = {
  register,

  /**
   * Initialize metrics service
   */
  initialize() {
    if (!monitoringConfig.enabled) {
      logger.info('Metrics collection is disabled');
      return;
    }

    // Start periodic collection of system metrics
    if (monitoringConfig.features.cpuMonitoring) {
      this.startCpuMonitoring();
    }

    if (monitoringConfig.features.memoryMonitoring) {
      this.startMemoryMonitoring();
    }

    if (monitoringConfig.features.databaseMonitoring) {
      this.setupDatabaseMonitoring();
    }

    logger.info('Metrics service initialized');
  },

  /**
   * Start monitoring CPU usage
   */
  startCpuMonitoring() {
    const interval = monitoringConfig.thresholds.cpu.interval * 1000;

    // Previous CPU times
    let prevCpuInfo = os.cpus();

    setInterval(() => {
      const cpuInfo = os.cpus();
      const cpuUsage = this.calculateCpuUsage(prevCpuInfo, cpuInfo);
      prevCpuInfo = cpuInfo;

      // Update Prometheus metric
      cpuUsageGauge.set(cpuUsage);

      // Check thresholds and alert if necessary
      if (cpuUsage >= monitoringConfig.thresholds.cpu.critical) {
        alertService.sendAlert({
          name: 'high_cpu_usage',
          severity: 'critical',
          message: `Critical CPU usage: ${cpuUsage.toFixed(2)}%`,
          value: cpuUsage,
          threshold: monitoringConfig.thresholds.cpu.critical,
          metadata: {
            cpuCores: os.cpus().length,
            loadAverage: os.loadavg(),
          },
        });
      } else if (cpuUsage >= monitoringConfig.thresholds.cpu.warning) {
        alertService.sendAlert({
          name: 'high_cpu_usage',
          severity: 'warning',
          message: `High CPU usage: ${cpuUsage.toFixed(2)}%`,
          value: cpuUsage,
          threshold: monitoringConfig.thresholds.cpu.warning,
          metadata: {
            cpuCores: os.cpus().length,
            loadAverage: os.loadavg(),
          },
        });
      }
      
      // Store historical CPU usage data in Redis for trend analysis
      this.storeMetricInRedis('cpu_usage', cpuUsage);
    }, interval);

    logger.info(`CPU usage monitoring started (interval: ${interval}ms)`);
  },

  /**
   * Calculate CPU usage between measurements
   * @param {Array} prevCpuInfo - Previous CPU info
   * @param {Array} currCpuInfo - Current CPU info
   * @returns {number} CPU usage percentage
   */
  calculateCpuUsage(prevCpuInfo, currCpuInfo) {
    let totalIdle = 0;
    let totalTick = 0;

    for (let i = 0; i < currCpuInfo.length; i++) {
      const prevTimes = prevCpuInfo[i].times;
      const currTimes = currCpuInfo[i].times;

      // Calculate the difference in CPU times
      const idleDiff = currTimes.idle - prevTimes.idle;
      const totalDiff = 
        (currTimes.user - prevTimes.user) +
        (currTimes.nice - prevTimes.nice) +
        (currTimes.sys - prevTimes.sys) +
        (currTimes.irq - prevTimes.irq) +
        (currTimes.idle - prevTimes.idle);

      totalIdle += idleDiff;
      totalTick += totalDiff;
    }

    // Calculate CPU usage percentage
    const cpuUsage = 100 - (totalIdle / totalTick * 100);
    return cpuUsage;
  },

  /**
   * Start monitoring memory usage
   */
  startMemoryMonitoring() {
    const interval = monitoringConfig.thresholds.memory.interval * 1000;

    setInterval(() => {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memUsagePercent = (usedMem / totalMem) * 100;
      
      // Process memory usage
      const processMemory = process.memoryUsage();

      // Update Prometheus metrics
      memoryUsageGauge.set({ type: 'system' }, usedMem);
      memoryUsageGauge.set({ type: 'rss' }, processMemory.rss);
      memoryUsageGauge.set({ type: 'heapTotal' }, processMemory.heapTotal);
      memoryUsageGauge.set({ type: 'heapUsed' }, processMemory.heapUsed);
      memoryUsageGauge.set({ type: 'external' }, processMemory.external);

      // Check thresholds and alert if necessary
      if (memUsagePercent >= monitoringConfig.thresholds.memory.critical) {
        alertService.sendAlert({
          name: 'high_memory_usage',
          severity: 'critical',
          message: `Critical memory usage: ${memUsagePercent.toFixed(2)}%`,
          value: memUsagePercent,
          threshold: monitoringConfig.thresholds.memory.critical,
          metadata: {
            totalMem: this.formatBytes(totalMem),
            usedMem: this.formatBytes(usedMem),
            freeMem: this.formatBytes(freeMem),
            processRss: this.formatBytes(processMemory.rss),
          },
        });
      } else if (memUsagePercent >= monitoringConfig.thresholds.memory.warning) {
        alertService.sendAlert({
          name: 'high_memory_usage',
          severity: 'warning',
          message: `High memory usage: ${memUsagePercent.toFixed(2)}%`,
          value: memUsagePercent,
          threshold: monitoringConfig.thresholds.memory.warning,
          metadata: {
            totalMem: this.formatBytes(totalMem),
            usedMem: this.formatBytes(usedMem),
            freeMem: this.formatBytes(freeMem),
            processRss: this.formatBytes(processMemory.rss),
          },
        });
      }
      
      // Store historical memory usage data in Redis
      this.storeMetricInRedis('memory_usage', memUsagePercent);
      this.storeMetricInRedis('process_memory_rss', processMemory.rss);
      this.storeMetricInRedis('process_memory_heap_used', processMemory.heapUsed);
    }, interval);

    logger.info(`Memory usage monitoring started (interval: ${interval}ms)`);
  },

  /**
   * Setup database monitoring
   */
  setupDatabaseMonitoring() {
    if (mongoose.connection.readyState !== 1) {
      logger.warn('Database not connected, monitoring not enabled');
      return;
    }

    // Monitor Mongoose queries
    mongoose.connection.on('query', (info) => {
      const startTime = Date.now();
      
      // Add callback to track query duration
      const originalCallback = info.callback;
      
      info.callback = function(err, result) {
        const duration = (Date.now() - startTime) / 1000; // convert to seconds
        
        // Record query duration in Prometheus
        databaseQueryDurationMicroseconds.observe(
          { operation: info.operation, collection: info.collection },
          duration
        );
        
        // Log slow queries
        if (
          monitoringConfig.thresholds.queryTime.logSlowQueries &&
          duration * 1000 >= monitoringConfig.thresholds.queryTime.warning
        ) {
          logger.warn(`Slow query (${duration.toFixed(2)}s) in ${info.collection}: ${info.query}`);
          
          // Alert on critically slow queries
          if (duration * 1000 >= monitoringConfig.thresholds.queryTime.critical) {
            alertService.sendAlert({
              name: 'slow_database_query',
              severity: 'critical',
              message: `Critical slow query: ${duration.toFixed(2)}s in ${info.collection}`,
              value: duration * 1000,
              threshold: monitoringConfig.thresholds.queryTime.critical,
              metadata: {
                collection: info.collection,
                operation: info.operation,
                query: JSON.stringify(info.query),
              },
            });
          }
        }
        
        // Call original callback
        if (typeof originalCallback === 'function') {
          originalCallback(err, result);
        }
      };
    });

    logger.info('Database query monitoring started');
  },

  /**
   * Record HTTP request duration
   * @param {string} method - HTTP method
   * @param {string} route - Route path
   * @param {number} statusCode - HTTP status code
   * @param {number} duration - Request duration in milliseconds
   */
  recordHttpRequest(method, route, statusCode, duration) {
    if (!monitoringConfig.enabled || !monitoringConfig.features.responseTimeMonitoring) {
      return;
    }

    // Normalize route by removing IDs
    const normalizedRoute = this.normalizeRoute(route);
    
    // Convert duration to seconds for Prometheus
    const durationSeconds = duration / 1000;
    
    // Record in Prometheus metrics
    httpRequestDurationMicroseconds.observe(
      { method, route: normalizedRoute, status: statusCode },
      durationSeconds
    );
    
    httpRequestTotal.inc({ method, route: normalizedRoute, status: statusCode });

    // Check for slow responses
    if (duration >= monitoringConfig.thresholds.responseTime.critical) {
      alertService.sendAlert({
        name: 'slow_api_response',
        severity: 'critical',
        message: `Critical slow API response: ${duration}ms for ${method} ${route}`,
        value: duration,
        threshold: monitoringConfig.thresholds.responseTime.critical,
        metadata: {
          method,
          route,
          statusCode,
        },
      });
    } else if (duration >= monitoringConfig.thresholds.responseTime.warning) {
      alertService.sendAlert({
        name: 'slow_api_response',
        severity: 'warning',
        message: `Slow API response: ${duration}ms for ${method} ${route}`,
        value: duration,
        threshold: monitoringConfig.thresholds.responseTime.warning,
        metadata: {
          method,
          route,
          statusCode,
        },
      });
    }

    // Store in Redis for historical tracking
    this.storeMetricInRedis(`api_response_${method}_${normalizedRoute}`, duration);
  },

  /**
   * Normalize route path for consistent metrics
   * @param {string} route - Route path
   * @returns {string} Normalized route
   */
  normalizeRoute(route) {
    // Remove ID patterns to group similar routes
    return route
      .replace(/\/[0-9a-fA-F]{24}/g, '/:id') // MongoDB IDs
      .replace(/\/\d+/g, '/:id');            // Numeric IDs
  },

  /**
   * Store metric value in Redis for historical tracking
   * @param {string} key - Metric key
   * @param {number} value - Metric value
   */
  async storeMetricInRedis(key, value) {
    if (!redisClient) return;
    
    try {
      const timestamp = Date.now();
      const metricKey = `metrics:${key}`;
      
      // Store as time series using Redis sorted set
      await redisClient.zadd(metricKey, timestamp, `${timestamp}:${value}`);
      
      // Trim to keep only recent history (last 24 hours)
      const cutoff = timestamp - (24 * 60 * 60 * 1000);
      await redisClient.zremrangebyscore(metricKey, 0, cutoff);
      
      // Set expiry to auto-cleanup old metrics
      await redisClient.expire(metricKey, 48 * 60 * 60); // 48 hours
    } catch (error) {
      logger.error('Error storing metric in Redis:', error);
    }
  },

  /**
   * Get historical metric data from Redis
   * @param {string} key - Metric key
   * @param {number} minutes - Minutes of history to retrieve
   * @returns {Promise<Array>} Array of [timestamp, value] pairs
   */
  async getMetricHistory(key, minutes = 60) {
    if (!redisClient) return [];
    
    try {
      const current = Date.now();
      const start = current - (minutes * 60 * 1000);
      const metricKey = `metrics:${key}`;
      
      // Get data from Redis sorted set
      const data = await redisClient.zrangebyscore(metricKey, start, current);
      
      // Parse and format the data
      return data.map(item => {
        const [timestamp, value] = item.split(':');
        return [parseInt(timestamp, 10), parseFloat(value)];
      });
    } catch (error) {
      logger.error('Error retrieving metric history from Redis:', error);
      return [];
    }
  },

  /**
   * Track appointment booking rate
   * @param {number} count - Number of appointments to increment by
   */
  trackAppointmentsBooked(count = 1) {
    if (!monitoringConfig.enabled || !monitoringConfig.features.businessMetrics) {
      return;
    }

    // Increment Prometheus counter
    appointmentsBookedCounter.inc(count);
    
    // Track in Redis for rate calculation
    this.incrementCounterInRedis('appointments_booked', count);
  },

  /**
   * Track patient registration rate
   * @param {number} count - Number of registrations to increment by
   */
  trackPatientRegistrations(count = 1) {
    if (!monitoringConfig.enabled || !monitoringConfig.features.businessMetrics) {
      return;
    }

    // Increment Prometheus counter
    patientRegistrationsCounter.inc(count);
    
    // Track in Redis for rate calculation
    this.incrementCounterInRedis('patient_registrations', count);
  },

  /**
   * Track prescription creation rate
   * @param {number} count - Number of prescriptions to increment by
   */
  trackPrescriptionsCreated(count = 1) {
    if (!monitoringConfig.enabled || !monitoringConfig.features.businessMetrics) {
      return;
    }

    // Increment Prometheus counter
    prescriptionsCreatedCounter.inc(count);
    
    // Track in Redis for rate calculation
    this.incrementCounterInRedis('prescriptions_created', count);
  },

  /**
   * Increment counter in Redis with timestamp for rate calculation
   * @param {string} key - Counter key
   * @param {number} count - Increment amount
   */
  async incrementCounterInRedis(key, count = 1) {
    if (!redisClient) return;
    
    try {
      const timestamp = Date.now();
      const minute = Math.floor(timestamp / 60000); // Current minute
      
      // Keys for different time windows
      const minuteKey = `counter:${key}:minute:${minute}`;
      const hourKey = `counter:${key}:hour:${Math.floor(minute / 60)}`;
      const dayKey = `counter:${key}:day:${Math.floor(minute / 1440)}`;
      
      // Increment counters for different windows
      await Promise.all([
        redisClient.incrby(minuteKey, count),
        redisClient.expire(minuteKey, 120), // 2 minutes TTL
        redisClient.incrby(hourKey, count),
        redisClient.expire(hourKey, 7200), // 2 hours TTL
        redisClient.incrby(dayKey, count),
        redisClient.expire(dayKey, 172800) // 2 days TTL
      ]);
    } catch (error) {
      logger.error(`Error incrementing counter ${key} in Redis:`, error);
    }
  },

  /**
   * Get the rate of a business metric (per minute/hour/day)
   * @param {string} key - Metric key
   * @param {string} period - Time period ('minute', 'hour', 'day')
   * @returns {Promise<number>} Rate value
   */
  async getMetricRate(key, period = 'minute') {
    if (!redisClient) return 0;
    
    try {
      const timestamp = Date.now();
      let timeframe;
      
      switch(period) {
        case 'minute':
          timeframe = Math.floor(timestamp / 60000);
          break;
        case 'hour':
          timeframe = Math.floor(timestamp / 3600000);
          break;
        case 'day':
          timeframe = Math.floor(timestamp / 86400000);
          break;
        default:
          timeframe = Math.floor(timestamp / 60000);
      }
      
      const counterKey = `counter:${key}:${period}:${timeframe}`;
      const value = await redisClient.get(counterKey);
      
      return parseInt(value, 10) || 0;
    } catch (error) {
      logger.error(`Error getting metric rate for ${key}:`, error);
      return 0;
    }
  },

  /**
   * Get business metrics for the application
   * @returns {Promise<Object>} Business metrics
   */
  async getBusinessMetrics() {
    const metrics = {};
    
    // Get rates for different time periods
    const metricTypes = [
      'appointments_booked',
      'patient_registrations',
      'prescriptions_created'
    ];
    
    const periods = ['minute', 'hour', 'day'];
    
    // Build metrics object
    for (const type of metricTypes) {
      metrics[type] = {};
      
      for (const period of periods) {
        const rate = await this.getMetricRate(type, period);
        metrics[type][`per_${period}`] = rate;
      }
    }
    
    // Add system metrics
    metrics.system = {
      cpu: await this.getMetricHistory('cpu_usage', 5),
      memory: await this.getMetricHistory('memory_usage', 5),
      uptime: process.uptime(),
    };
    
    return metrics;
  },

  /**
   * Check if a business metric rate exceeds a threshold
   * @param {string} metricKey - Metric key
   * @param {string} period - Time period
   * @param {number} threshold - Threshold value
   * @returns {Promise<boolean>} True if threshold is exceeded
   */
  async checkMetricThreshold(metricKey, period, threshold) {
    const rate = await this.getMetricRate(metricKey, period);
    return rate >= threshold;
  },

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted size string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Export metrics in Prometheus format
   * @returns {Promise<string>} Metrics in Prometheus format
   */
  async getPrometheusMetrics() {
    return register.metrics();
  },
};

module.exports = metricsService;
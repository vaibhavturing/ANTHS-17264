/**
 * Health Check Utility
 * Provides functions to check health of application components
 * Used by load balancers and container orchestration for instance viability
 */

const mongoose = require('mongoose');
const redisClients = require('../config/redis.config');
const storageService = require('../config/storage.config');
const { version } = require('../../package.json');
const logger = require('./logger');
const os = require('os');

/**
 * Health check service
 */
const healthCheck = {
  /**
   * Check application basic health
   * @returns {Object} Health status
   */
  basic: async () => {
    return {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      version: version,
      env: process.env.NODE_ENV
    };
  },
  
  /**
   * Check application detailed health status
   * @returns {Object} Detailed health status
   */
  detailed: async () => {
    try {
      // Check MongoDB connection
      let dbStatus = 'ok';
      let dbError = null;
      
      try {
        if (mongoose.connection.readyState !== 1) {
          dbStatus = 'error';
          dbError = 'Database not connected';
        }
      } catch (error) {
        dbStatus = 'error';
        dbError = error.message;
      }
      
      // Check Redis connection
      let redisStatus = 'ok';
      let redisError = null;
      
      try {
        const redisClient = redisClients.getClient();
        await redisClient.ping();
      } catch (error) {
        redisStatus = 'error';
        redisError = error.message;
      }
      
      // Check storage service
      let storageStatus = 'ok';
      let storageError = null;
      
      try {
        if (storageService.isCloudStorageEnabled()) {
          await storageService.listFiles('', { maxKeys: 1 });
        } else {
          storageStatus = 'not-configured';
        }
      } catch (error) {
        storageStatus = 'error';
        storageError = error.message;
      }
      
      // Get system resources
      const memoryUsage = process.memoryUsage();
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const cpus = os.cpus().length;
      const loadAvg = os.loadavg();
      
      // Collect status
      return {
        status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: version,
        env: process.env.NODE_ENV,
        instance: process.env.INSTANCE_ID || os.hostname(),
        services: {
          database: {
            status: dbStatus,
            error: dbError,
            connection: mongoose.connection.readyState
          },
          redis: {
            status: redisStatus,
            error: redisError
          },
          storage: {
            status: storageStatus,
            error: storageError,
            type: storageService.isCloudStorageEnabled() ? 's3' : 'local'
          }
        },
        system: {
          memory: {
            total: formatBytes(totalMemory),
            free: formatBytes(freeMemory),
            usage: Math.round((1 - freeMemory / totalMemory) * 100) + '%',
            process: {
              rss: formatBytes(memoryUsage.rss),
              heapTotal: formatBytes(memoryUsage.heapTotal),
              heapUsed: formatBytes(memoryUsage.heapUsed),
              external: formatBytes(memoryUsage.external)
            }
          },
          cpu: {
            cores: cpus,
            loadAvg: loadAvg
          }
        }
      };
    } catch (error) {
      logger.error('Health check failed:', error);
      
      return {
        status: 'error',
        timestamp: new Date(),
        error: error.message
      };
    }
  },
  
  /**
   * Check readiness for serving requests
   * @returns {Object} Readiness status
   */
  readiness: async () => {
    const mongoReady = mongoose.connection.readyState === 1;
    
    let redisReady = false;
    try {
      const redisClient = redisClients.getClient();
      await redisClient.ping();
      redisReady = true;
    } catch (error) {
      logger.error('Redis not ready:', error);
    }
    
    // Application is ready when MongoDB and Redis are connected
    const isReady = mongoReady && redisReady;
    
    return {
      status: isReady ? 'ready' : 'not-ready',
      mongodb: mongoReady,
      redis: redisReady,
      timestamp: new Date()
    };
  },
  
  /**
   * Check database health specifically
   * @returns {Object} Database health status 
   */
  databaseHealth: async () => {
    try {
      // Check MongoDB connection
      if (mongoose.connection.readyState !== 1) {
        return {
          status: 'error',
          message: 'Database not connected',
          readyState: mongoose.connection.readyState
        };
      }
      
      // Try a simple command to verify responsiveness
      const adminDb = mongoose.connection.db.admin();
      const serverStatus = await adminDb.serverStatus();
      
      return {
        status: 'ok',
        version: serverStatus.version,
        uptime: serverStatus.uptime,
        connections: serverStatus.connections,
        ok: true
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      
      return {
        status: 'error',
        message: error.message,
        readyState: mongoose.connection.readyState,
        ok: false
      };
    }
  }
};

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = healthCheck;
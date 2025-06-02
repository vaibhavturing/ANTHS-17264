/**
 * Health Check Controller
 * Monitors application status and dependencies
 */

const mongoose = require('mongoose');
const systeminformation = require('systeminformation');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Get basic liveness status
 * Used for Kubernetes liveness probe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLivenessStatus = (req, res) => {
  return res.status(200).json({
    status: 'success',
    message: 'Service is alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

/**
 * Get application readiness status
 * Used for Kubernetes readiness probe
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getReadinessStatus = async (req, res) => {
  // Check database connection
  const isDbConnected = mongoose.connection.readyState === 1;
  
  if (!isDbConnected) {
    logger.warn('Health check failed: Database not connected');
    return res.status(503).json({
      status: 'error',
      message: 'Service is not ready',
      details: 'Database connection is down',
      timestamp: new Date().toISOString()
    });
  }
  
  return res.status(200).json({
    status: 'success',
    message: 'Service is ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'connected'
    }
  });
};

/**
 * Get deep health status including all dependencies
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDeepHealthStatus = async (req, res) => {
  try {
    // Check database connection and response time
    const dbStartTime = Date.now();
    const isDbConnected = mongoose.connection.readyState === 1;
    let dbStatus = { connected: isDbConnected };
    
    // Only run ping if connected
    if (isDbConnected) {
      try {
        await mongoose.connection.db.admin().ping();
        dbStatus.responseTime = Date.now() - dbStartTime;
        dbStatus.status = 'healthy';
      } catch (error) {
        logger.error('Database ping failed', { error: error.message });
        dbStatus.status = 'degraded';
        dbStatus.error = 'Database ping failed';
      }
    } else {
      dbStatus.status = 'unhealthy';
    }
    
    // Check disk space
    const diskSpace = await systeminformation.fsSize();
    const systemDisk = diskSpace.find(disk => disk.mount === '/') || diskSpace[0];
    const diskUsagePercent = systemDisk ? systemDisk.use : null;
    
    // Determine overall system status
    const isHealthy = isDbConnected && 
                      (!diskUsagePercent || diskUsagePercent < 90);
    
    const healthStatus = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: config.version || '1.0.0',
      environment: config.env,
      uptime: process.uptime(),
      dependencies: {
        database: dbStatus,
        diskSpace: {
          status: diskUsagePercent < 90 ? 'healthy' : 'warning',
          usagePercent: diskUsagePercent,
          free: systemDisk ? `${Math.round(systemDisk.size * (100 - systemDisk.use) / 100 / 1024 / 1024 / 1024)}GB` : 'unknown'
        }
      }
    };
    
    // Set appropriate status code
    const statusCode = isHealthy ? 200 : 503;
    
    return res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('Deep health check failed', { error: error.message, stack: error.stack });
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get detailed system metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSystemMetrics = async (req, res) => {
  try {
    // Collect various system metrics in parallel
    const [cpuLoad, memInfo, currentLoad, processLoad] = await Promise.all([
      systeminformation.currentLoad(),
      systeminformation.mem(),
      systeminformation.currentLoad(),
      systeminformation.processes()
    ]);
    
    // Get current process
    const currentPid = process.pid;
    const currentProcess = processLoad.list.find(p => p.pid === currentPid);
    
    // Get Node.js specific metrics
    const nodeMetrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      resourceUsage: process.resourceUsage ? process.resourceUsage() : null,
      uptime: process.uptime()
    };
    
    // Calculate memory usage percentage for process
    const processMemoryPercent = currentProcess 
      ? (currentProcess.memRss / memInfo.total) * 100
      : null;
    
    // Get database metrics if connected
    let dbMetrics = { connected: false };
    if (mongoose.connection.readyState === 1) {
      try {
        const dbStats = await mongoose.connection.db.stats();
        dbMetrics = {
          connected: true,
          collections: dbStats.collections,
          documents: dbStats.objects,
          dataSize: `${Math.round(dbStats.dataSize / 1024 / 1024)}MB`,
          storageSize: `${Math.round(dbStats.storageSize / 1024 / 1024)}MB`,
          indexes: dbStats.indexes,
          indexSize: `${Math.round(dbStats.indexSize / 1024 / 1024)}MB`
        };
      } catch (error) {
        logger.error('Failed to get database metrics', { error: error.message });
        dbMetrics.error = error.message;
      }
    }
    
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        cpuLoad: {
          currentLoad: cpuLoad.currentLoad,
          cpus: cpuLoad.cpus.map(cpu => cpu.load)
        },
        memory: {
          total: `${Math.round(memInfo.total / 1024 / 1024 / 1024)}GB`,
          used: `${Math.round(memInfo.used / 1024 / 1024 / 1024)}GB`,
          free: `${Math.round(memInfo.free / 1024 / 1024 / 1024)}GB`,
          usedPercent: (memInfo.used / memInfo.total) * 100
        }
      },
      process: {
        pid: currentPid,
        memoryUsage: currentProcess 
          ? `${Math.round(currentProcess.memRss / 1024 / 1024)}MB` 
          : 'unknown',
        memoryPercent: processMemoryPercent,
        cpuUsage: currentProcess ? currentProcess.cpu : null,
        uptime: process.uptime()
      },
      nodejs: {
        version: process.version,
        heapUsed: `${Math.round(nodeMetrics.memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(nodeMetrics.memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(nodeMetrics.memoryUsage.external / 1024 / 1024)}MB`,
        arrayBuffers: nodeMetrics.memoryUsage.arrayBuffers 
          ? `${Math.round(nodeMetrics.memoryUsage.arrayBuffers / 1024 / 1024)}MB` 
          : null
      },
      database: dbMetrics
    };
    
    return res.status(200).json(metrics);
  } catch (error) {
    logger.error('Failed to get system metrics', { error: error.message, stack: error.stack });
    return res.status(500).json({
      status: 'error',
      message: 'Failed to get system metrics',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  getLivenessStatus,
  getReadinessStatus,
  getDeepHealthStatus,
  getSystemMetrics
};
/**
 * Memory Profiler Utility
 * Used to track and identify memory leaks in the application
 * 
 * This utility leverages Node.js built-in memory profiling capabilities
 * and provides simple API for tracking memory usage throughout the application
 */

const v8 = require('v8');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Directory for storing heap snapshots
const SNAPSHOT_DIR = path.join(__dirname, '../../diagnostics/memory-snapshots');

// Ensure the directory exists
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

/**
 * Memory profiler utility
 */
const memoryProfiler = {
  /**
   * Take a heap snapshot and save it to file
   * @param {string} label - Label for the snapshot (used in filename)
   * @returns {string} Path to the saved snapshot file
   */
  takeSnapshot: (label) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}-${label || 'snapshot'}.heapsnapshot`;
      const snapshotPath = path.join(SNAPSHOT_DIR, filename);
      
      const heapSnapshot = v8.getHeapSnapshot();
      const fileStream = fs.createWriteStream(snapshotPath);
      
      // Pipe the snapshot to file
      heapSnapshot.pipe(fileStream);
      
      logger.info(`Heap snapshot saved to ${snapshotPath}`);
      return snapshotPath;
    } catch (error) {
      logger.error('Failed to take heap snapshot', error);
      throw error;
    }
  },
  
  /**
   * Get current memory usage statistics
   * @returns {Object} Memory usage statistics
   */
  getMemoryUsage: () => {
    const memoryUsage = process.memoryUsage();
    
    return {
      rss: formatMemorySize(memoryUsage.rss),
      heapTotal: formatMemorySize(memoryUsage.heapTotal),
      heapUsed: formatMemorySize(memoryUsage.heapUsed),
      external: formatMemorySize(memoryUsage.external),
      arrayBuffers: formatMemorySize(memoryUsage.arrayBuffers || 0),
      raw: memoryUsage
    };
  },
  
  /**
   * Start periodic memory usage logging
   * @param {number} interval - Logging interval in milliseconds
   * @returns {Function} Function to stop the periodic logging
   */
  startPeriodicLogging: (interval = 60000) => {
    logger.info(`Starting periodic memory usage logging (${interval}ms)`);
    
    const intervalId = setInterval(() => {
      const usage = memoryProfiler.getMemoryUsage();
      logger.info('Memory usage', { 
        heapUsed: usage.heapUsed, 
        heapTotal: usage.heapTotal,
        rss: usage.rss 
      });
    }, interval);
    
    return () => {
      clearInterval(intervalId);
      logger.info('Stopped periodic memory usage logging');
    };
  },
  
  /**
   * Measure memory usage before and after a function execution
   * @param {Function} fn - Function to measure
   * @param {Array} args - Arguments to pass to the function
   * @returns {Promise<Object>} Result and memory usage information
   */
  measureFunction: async (fn, ...args) => {
    const startUsage = process.memoryUsage();
    global.gc && global.gc(); // Force garbage collection if available
    
    const startTime = process.hrtime.bigint();
    const result = await fn(...args);
    const endTime = process.hrtime.bigint();
    
    global.gc && global.gc(); // Force garbage collection if available
    const endUsage = process.memoryUsage();
    
    const memoryDiff = {
      rss: formatMemorySize(endUsage.rss - startUsage.rss),
      heapTotal: formatMemorySize(endUsage.heapTotal - startUsage.heapTotal),
      heapUsed: formatMemorySize(endUsage.heapUsed - startUsage.heapUsed),
      external: formatMemorySize(endUsage.external - startUsage.external),
      duration: Number(endTime - startTime) / 1_000_000 // Convert nanoseconds to milliseconds
    };
    
    return { result, memoryDiff };
  }
};

/**
 * Format memory size from bytes to human-readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted memory size
 */
function formatMemorySize(bytes) {
  if (Math.abs(bytes) < 1024) {
    return bytes + ' B';
  }
  
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let u = -1;
  const r = 10;
  
  do {
    bytes /= 1024;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= 1024 && u < units.length - 1);
  
  return bytes.toFixed(2) + ' ' + units[u];
}

module.exports = memoryProfiler;
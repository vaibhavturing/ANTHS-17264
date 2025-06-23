/**
 * Performance Testing Utility
 * Provides tools for measuring and comparing application performance
 */

const { performance, PerformanceObserver } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const logger = require('./logger');
const redisClients = require('../config/redis.config');

// Directory for storing test results
const RESULTS_DIR = path.join(__dirname, '../../performance-results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Performance testing utility
 */
const performanceTesting = {
  /**
   * Run a performance test
   * @param {string} name - Test name
   * @param {Function} fn - Function to test
   * @param {Array} args - Arguments to pass to the function
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async runTest(name, fn, args = [], options = {}) {
    if (typeof fn !== 'function') {
      throw new Error('Test function is required');
    }
    
    const testOptions = {
      iterations: options.iterations || 1,
      warmup: options.warmup || 0,
      setup: options.setup || null,
      teardown: options.teardown || null,
      beforeEach: options.beforeEach || null,
      afterEach: options.afterEach || null,
      ...options
    };
    
    // Run setup function if provided
    if (typeof testOptions.setup === 'function') {
      await testOptions.setup();
    }
    
    // Perform warmup runs
    for (let i = 0; i < testOptions.warmup; i++) {
      if (typeof testOptions.beforeEach === 'function') {
        await testOptions.beforeEach();
      }
      
      await fn(...args);
      
      if (typeof testOptions.afterEach === 'function') {
        await testOptions.afterEach();
      }
    }
    
    const results = {
      name,
      timestamp: new Date().toISOString(),
      iterations: testOptions.iterations,
      times: [],
      memoryUsage: [],
      dbQueries: [],
      totalTime: 0,
      averageTime: 0,
      medianTime: 0,
      p95Time: 0,
      maxTime: 0,
      minTime: 0,
      metadata: options.metadata || {}
    };
    
    // Set up query counter for MongoDB if connected
    let originalExec;
    let queryCount = 0;
    
    if (mongoose.connection.readyState === 1) {
      originalExec = mongoose.Query.prototype.exec;
      
      mongoose.Query.prototype.exec = function() {
        queryCount++;
        return originalExec.apply(this, arguments);
      };
    }
    
    // Run test iterations
    for (let i = 0; i < testOptions.iterations; i++) {
      if (typeof testOptions.beforeEach === 'function') {
        await testOptions.beforeEach();
      }
      
      // Reset query counter for this iteration
      queryCount = 0;
      
      // Record memory before
      const memoryBefore = process.memoryUsage();
      
      // Force garbage collection if available
      global.gc && global.gc();
      
      // Measure execution time
      const startTime = performance.now();
      await fn(...args);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Force garbage collection again
      global.gc && global.gc();
      
      // Record memory after
      const memoryAfter = process.memoryUsage();
      
      // Calculate memory diff
      const memoryDiff = {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        external: memoryAfter.external - memoryBefore.external
      };
      
      // Record results
      results.times.push(duration);
      results.memoryUsage.push(memoryDiff);
      results.dbQueries.push(queryCount);
      
      if (typeof testOptions.afterEach === 'function') {
        await testOptions.afterEach();
      }
    }
    
    // Restore original MongoDB exec function
    if (originalExec) {
      mongoose.Query.prototype.exec = originalExec;
    }
    
    // Calculate statistics
    results.times.sort((a, b) => a - b);
    results.totalTime = results.times.reduce((sum, time) => sum + time, 0);
    results.averageTime = results.totalTime / results.iterations;
    results.medianTime = this.calculateMedian(results.times);
    results.p95Time = this.calculatePercentile(results.times, 95);
    results.minTime = results.times[0];
    results.maxTime = results.times[results.times.length - 1];
    
    // Calculate database metrics
    if (results.dbQueries.length > 0) {
      results.totalQueries = results.dbQueries.reduce((sum, count) => sum + count, 0);
      results.averageQueries = results.totalQueries / results.iterations;
    }
    
    // Calculate memory metrics
    if (results.memoryUsage.length > 0) {
      results.averageMemoryRss = results.memoryUsage
        .reduce((sum, mem) => sum + mem.rss, 0) / results.iterations;
      results.averageMemoryHeapUsed = results.memoryUsage
        .reduce((sum, mem) => sum + mem.heapUsed, 0) / results.iterations;
    }
    
    // Run teardown function if provided
    if (typeof testOptions.teardown === 'function') {
      await testOptions.teardown();
    }
    
    // Log results
    logger.info(`Performance test "${name}" completed:`, {
      iterations: results.iterations,
      averageTime: `${results.averageTime.toFixed(2)} ms`,
      p95Time: `${results.p95Time.toFixed(2)} ms`,
      totalQueries: results.totalQueries,
      averageMemoryHeapUsed: this.formatBytes(results.averageMemoryHeapUsed)
    });
    
    return results;
  },
  
  /**
   * Compare test results with previous results
   * @param {Object} currentResults - Current test results
   * @param {Object} previousResults - Previous test results
   * @returns {Object} Comparison results
   */
  compareResults(currentResults, previousResults) {
    if (!currentResults || !previousResults) {
      throw new Error('Both current and previous results are required for comparison');
    }
    
    const comparison = {
      name: currentResults.name,
      timestamp: new Date().toISOString(),
      current: {
        averageTime: currentResults.averageTime,
        p95Time: currentResults.p95Time,
        medianTime: currentResults.medianTime,
        totalQueries: currentResults.totalQueries || 0,
        averageQueries: currentResults.averageQueries || 0,
        averageMemoryHeapUsed: currentResults.averageMemoryHeapUsed || 0
      },
      previous: {
        averageTime: previousResults.averageTime,
        p95Time: previousResults.p95Time,
        medianTime: previousResults.medianTime,
        totalQueries: previousResults.totalQueries || 0,
        averageQueries: previousResults.averageQueries || 0,
        averageMemoryHeapUsed: previousResults.averageMemoryHeapUsed || 0
      },
      diff: {
        averageTime: currentResults.averageTime - previousResults.averageTime,
        p95Time: currentResults.p95Time - previousResults.p95Time,
        medianTime: currentResults.medianTime - previousResults.medianTime,
        totalQueries: (currentResults.totalQueries || 0) - (previousResults.totalQueries || 0),
        averageQueries: (currentResults.averageQueries || 0) - (previousResults.averageQueries || 0),
        averageMemoryHeapUsed: (currentResults.averageMemoryHeapUsed || 0) - (previousResults.averageMemoryHeapUsed || 0)
      },
      percentageChange: {}
    };
    
    // Calculate percentage change for each metric
    for (const key in comparison.diff) {
      if (previousResults[key] !== 0 && previousResults[key] !== undefined) {
        comparison.percentageChange[key] = (comparison.diff[key] / previousResults[key]) * 100;
      } else {
        comparison.percentageChange[key] = comparison.diff[key] > 0 ? 100 : 0;
      }
    }
    
    // Log comparison
    logger.info(`Performance comparison for "${currentResults.name}":`, {
      averageTime: `${comparison.diff.averageTime.toFixed(2)} ms (${comparison.percentageChange.averageTime.toFixed(2)}%)`,
      p95Time: `${comparison.diff.p95Time.toFixed(2)} ms (${comparison.percentageChange.p95Time.toFixed(2)}%)`,
      queries: `${comparison.diff.averageQueries.toFixed(2)} queries (${comparison.percentageChange.averageQueries.toFixed(2)}%)`
    });
    
    return comparison;
  },
  
  /**
   * Save test results to file
   * @param {Object} results - Test results
   * @returns {Promise<string>} Path to saved file
   */
  async saveResults(results) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${results.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.json`;
      const filePath = path.join(RESULTS_DIR, filename);
      
      await fs.promises.writeFile(filePath, JSON.stringify(results, null, 2));
      logger.info(`Performance test results saved to ${filePath}`);
      
      return filePath;
    } catch (error) {
      logger.error('Error saving test results:', error);
      throw error;
    }
  },
  
  /**
   * Load previous test results
   * @param {string} testName - Test name
   * @returns {Promise<Object>} Previous test results or null if not found
   */
  async loadPreviousResults(testName) {
    try {
      // Sanitize test name for file search
      const sanitizedName = testName.replace(/\s+/g, '-').toLowerCase();
      
      // Read all files in the results directory
      const files = await fs.promises.readdir(RESULTS_DIR);
      
      // Filter files matching the test name and sort by name (timestamp)
      const matchingFiles = files
        .filter(file => file.startsWith(sanitizedName) && file.endsWith('.json'))
        .sort()
        .reverse();
      
      // If no matching files found, return null
      if (matchingFiles.length === 0) {
        return null;
      }
      
      // Load the most recent result
      const latestFile = matchingFiles[0];
      const filePath = path.join(RESULTS_DIR, latestFile);
      const data = await fs.promises.readFile(filePath, 'utf8');
      
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Error loading previous results for "${testName}":`, error);
      return null;
    }
  },
  
  /**
   * Calculate median value from an array
   * @param {Array<number>} values - Array of values
   * @returns {number} Median value
   */
  calculateMedian(values) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
  },
  
  /**
   * Calculate percentile value from an array
   * @param {Array<number>} values - Array of values
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(values, percentile) {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }
    
    if (percentile <= 0) return values[0];
    if (percentile >= 100) return values[values.length - 1];
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[index];
  },
  
  /**
   * Format bytes to human-readable string
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  /**
   * Generate performance report comparing all test results
   * @returns {Promise<Object>} Report data
   */
  async generateReport() {
    try {
      // Read all result files
      const files = await fs.promises.readdir(RESULTS_DIR);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Group files by test name
      const testGroups = {};
      
      for (const file of jsonFiles) {
        const filePath = path.join(RESULTS_DIR, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        const result = JSON.parse(data);
        
        // Extract test name without timestamp
        const testName = result.name;
        
        if (!testGroups[testName]) {
          testGroups[testName] = [];
        }
        
        testGroups[testName].push({
          ...result,
          file
        });
      }
      
      // Sort each group by timestamp
      for (const testName in testGroups) {
        testGroups[testName].sort((a, b) => 
          new Date(a.timestamp) - new Date(b.timestamp)
        );
      }
      
      // Generate report data
      const report = {
        generatedAt: new Date().toISOString(),
        tests: {}
      };
      
      for (const testName in testGroups) {
        const tests = testGroups[testName];
        
        // Need at least 2 tests to compare
        if (tests.length < 2) continue;
        
        const oldest = tests[0];
        const newest = tests[tests.length - 1];
        
        // Compare oldest and newest results
        const comparison = this.compareResults(newest, oldest);
        
        // Calculate improvement percentage
        const timeImprovement = (oldest.averageTime - newest.averageTime) / oldest.averageTime * 100;
        
        report.tests[testName] = {
          firstTest: oldest.timestamp,
          latestTest: newest.timestamp,
          testCount: tests.length,
          firstAverage: oldest.averageTime,
          latestAverage: newest.averageTime,
          improvement: timeImprovement,
          comparison
        };
      }
      
      // Save report to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(RESULTS_DIR, `performance-report-${timestamp}.json`);
      await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`Performance report generated at ${reportPath}`);
      
      return report;
    } catch (error) {
      logger.error('Error generating performance report:', error);
      throw error;
    }
  }
};

module.exports = performanceTesting;
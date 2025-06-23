/**
 * Benchmark Service
 * Provides standardized benchmarking tools for the application
 */

const performanceTesting = require('../utils/performanceTesting');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const redisClients = require('../config/redis.config');

/**
 * Benchmark service for standardized performance testing
 */
const benchmarkService = {
  /**
   * Benchmark a database query
   * @param {string} name - Benchmark name
   * @param {Function} queryFn - Query function to benchmark
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkQuery(name, queryFn, options = {}) {
    if (typeof queryFn !== 'function') {
      throw new Error('Query function is required');
    }
    
    // Default options
    const defaultOptions = {
      iterations: 10,
      warmup: 2,
      clearCache: true,
      compareWithPrevious: true,
      saveResults: true
    };
    
    const benchmarkOptions = { ...defaultOptions, ...options };
    
    // Setup function to clear caches if needed
    const setup = async () => {
      if (benchmarkOptions.clearCache) {
        // Clear MongoDB query cache if connected
        if (mongoose.connection.readyState === 1) {
          await mongoose.connection.db.command({ planCacheClear: '*' });
        }
        
        // Clear Redis cache if available
        const redisClient = redisClients.getCacheClient();
        if (redisClient) {
          // Only clear keys with a specific pattern to avoid disrupting other data
          const benchmarkPattern = 'benchmark:*';
          const cachePattern = 'cache:*';
          
          try {
            const scanAndDelete = async (pattern) => {
              let cursor = '0';
              do {
                const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = newCursor;
                
                if (keys.length > 0) {
                  await redisClient.del(keys);
                }
              } while (cursor !== '0');
            };
            
            await scanAndDelete(benchmarkPattern);
            
            // Only clear cache pattern if explicitly allowed
            if (benchmarkOptions.clearAppCache) {
              await scanAndDelete(cachePattern);
            }
          } catch (error) {
            logger.warn('Error clearing Redis cache for benchmark:', error);
          }
        }
      }
    };
    
    // Run the test
    const results = await performanceTesting.runTest(name, queryFn, [], {
      ...benchmarkOptions,
      setup,
      metadata: {
        type: 'database_query',
        model: options.model || 'unknown',
        operation: options.operation || 'unknown',
        ...options.metadata
      }
    });
    
    // Compare with previous results
    if (benchmarkOptions.compareWithPrevious) {
      const previousResults = await performanceTesting.loadPreviousResults(name);
      
      if (previousResults) {
        const comparison = performanceTesting.compareResults(results, previousResults);
        results.comparison = comparison;
      }
    }
    
    // Save results
    if (benchmarkOptions.saveResults) {
      await performanceTesting.saveResults(results);
    }
    
    return results;
  },
  
  /**
   * Benchmark an API endpoint
   * @param {string} name - Benchmark name
   * @param {Function} requestFn - Request function to benchmark
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkEndpoint(name, requestFn, options = {}) {
    if (typeof requestFn !== 'function') {
      throw new Error('Request function is required');
    }
    
    // Default options
    const defaultOptions = {
      iterations: 5,
      warmup: 1,
      saveResults: true,
      compareWithPrevious: true
    };
    
    const benchmarkOptions = { ...defaultOptions, ...options };
    
    // Run the test
    const results = await performanceTesting.runTest(name, requestFn, [], {
      ...benchmarkOptions,
      metadata: {
        type: 'api_endpoint',
        method: options.method || 'unknown',
        endpoint: options.endpoint || 'unknown',
        ...options.metadata
      }
    });
    
    // Compare with previous results
    if (benchmarkOptions.compareWithPrevious) {
      const previousResults = await performanceTesting.loadPreviousResults(name);
      
      if (previousResults) {
        const comparison = performanceTesting.compareResults(results, previousResults);
        results.comparison = comparison;
      }
    }
    
    // Save results
    if (benchmarkOptions.saveResults) {
      await performanceTesting.saveResults(results);
    }
    
    return results;
  },
  
  /**
   * Benchmark a specific operation or function
   * @param {string} name - Benchmark name
   * @param {Function} fn - Function to benchmark
   * @param {Array} args - Function arguments
   * @param {Object} options - Benchmark options
   * @returns {Promise<Object>} Benchmark results
   */
  async benchmarkOperation(name, fn, args = [], options = {}) {
    if (typeof fn !== 'function') {
      throw new Error('Function is required');
    }
    
    // Default options
    const defaultOptions = {
      iterations: 20,
      warmup: 5,
      saveResults: true,
      compareWithPrevious: true
    };
    
    const benchmarkOptions = { ...defaultOptions, ...options };
    
    // Run the test
    const results = await performanceTesting.runTest(name, fn, args, {
      ...benchmarkOptions,
      metadata: {
        type: 'operation',
        functionName: fn.name || 'anonymous',
        ...options.metadata
      }
    });
    
    // Compare with previous results
    if (benchmarkOptions.compareWithPrevious) {
      const previousResults = await performanceTesting.loadPreviousResults(name);
      
      if (previousResults) {
        const comparison = performanceTesting.compareResults(results, previousResults);
        results.comparison = comparison;
      }
    }
    
    // Save results
    if (benchmarkOptions.saveResults) {
      await performanceTesting.saveResults(results);
    }
    
    return results;
  },
  
  /**
   * Generate comprehensive performance report
   * @returns {Promise<Object>} Report data
   */
  async generateReport() {
    return await performanceTesting.generateReport();
  },
  
  /**
   * Get all benchmark results for a specific test
   * @param {string} testName - Test name
   * @returns {Promise<Array>} Test results
   */
  async getTestResults(testName) {
    try {
      // Sanitize test name
      const sanitizedName = testName.replace(/\s+/g, '-').toLowerCase();
      
      // Get all result files
      const fs = require('fs');
      const path = require('path');
      const RESULTS_DIR = path.join(__dirname, '../../performance-results');
      
      const files = await fs.promises.readdir(RESULTS_DIR);
      const matchingFiles = files.filter(file => 
        file.startsWith(sanitizedName) && file.endsWith('.json')
      );
      
      // Load and parse each file
      const results = [];
      
      for (const file of matchingFiles) {
        const filePath = path.join(RESULTS_DIR, file);
        const data = await fs.promises.readFile(filePath, 'utf8');
        
        try {
          const result = JSON.parse(data);
          results.push(result);
        } catch (error) {
          logger.warn(`Error parsing benchmark result file ${file}:`, error);
        }
      }
      
      // Sort by timestamp
      results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      return results;
    } catch (error) {
      logger.error(`Error getting benchmark results for "${testName}":`, error);
      return [];
    }
  }
};

module.exports = benchmarkService;
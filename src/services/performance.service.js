// src/services/performance.service.js
const newrelic = require('newrelic');
const logger = require('../utils/logger');

/**
 * Service for tracking and analyzing application performance
 */
const performanceService = {
  /**
   * Start a custom New Relic transaction
   * @param {string} name - Name of the transaction
   * @param {string} group - Group for the transaction
   * @returns {Object} Transaction object
   */
  startTransaction: (name, group) => {
    return newrelic.startWebTransaction(name, function() {
      const transaction = newrelic.getTransaction();
      return transaction;
    });
  },
  
  /**
   * End a custom New Relic transaction
   * @param {Object} transaction - Transaction object
   */
  endTransaction: (transaction) => {
    if (transaction) {
      transaction.end();
    }
  },
  
  /**
   * Track a specific segment of code
   * @param {string} name - Name of the segment
   * @param {Function} fn - Function to execute and track
   * @returns {Promise} Result of the function
   */
  trackSegment: async (name, fn) => {
    const startTime = Date.now();
    try {
      const segment = newrelic.startSegment(name, false);
      const result = await fn();
      segment.end();
      
      const duration = Date.now() - startTime;
      if (duration > 500) {
        logger.warn(`Slow operation detected: ${name} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error in ${name} after ${duration}ms:`, error);
      throw error;
    }
  },
  
  /**
   * Get performance metrics for specific operations
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics: () => {
    // This would typically pull data from New Relic's API
    // For now, we'll return a placeholder
    return {
      timestamp: new Date().toISOString(),
      message: 'Performance metrics would be fetched from New Relic API'
    };
  }
};

module.exports = performanceService;
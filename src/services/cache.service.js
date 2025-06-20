// src/services/cache.service.js
const redis = require('../config/redis.config');
const logger = require('../utils/logger');
const crypto = require('crypto');
const config = require('../config/config');

/**
 * Service for handling caching operations
 */
const cacheService = {
  /**
   * Default cache TTL in seconds (30 minutes)
   */
  DEFAULT_TTL: 30 * 60,

  /**
   * Generate a cache key based on the input parameters
   * @param {string} prefix - Prefix for the cache key
   * @param {Object} params - Parameters to include in the key
   * @returns {string} Generated cache key
   */
  generateKey: (prefix, params) => {
    // Sort keys to ensure consistent key generation
    const sortedParams = params ? 
      Object.keys(params)
        .sort()
        .reduce((obj, key) => {
          obj[key] = params[key];
          return obj;
        }, {}) :
      {};
    
    const hashContent = JSON.stringify(sortedParams);
    const hash = crypto
      .createHash('md5')
      .update(hashContent)
      .digest('hex');
    
    return `${prefix}:${hash}`;
  },

  /**
   * Get data from cache
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Cached data or null if not found
   */
  get: async (key) => {
    try {
      const data = await redis.getAsync(key);
      if (data) {
        logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(data);
      }
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Error getting cache for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set data in cache
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  set: async (key, data, ttl = cacheService.DEFAULT_TTL) => {
    try {
      const serialized = JSON.stringify(data);
      await redis.setAsync(key, serialized);
      if (ttl) {
        await redis.expireAsync(key, ttl);
      }
      logger.debug(`Cache set for key: ${key}, TTL: ${ttl}s`);
      return true;
    } catch (error) {
      logger.error(`Error setting cache for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete data from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  delete: async (key) => {
    try {
      await redis.delAsync(key);
      logger.debug(`Cache deleted for key: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting cache for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Clear cache keys matching a pattern
   * @param {string} pattern - Pattern to match 
   * @returns {Promise<number>} Number of keys deleted
   */
  clearPattern: async (pattern) => {
    try {
      let cursor = '0';
      let keysDeleted = 0;
      
      do {
        // Scan for keys matching pattern
        const [nextCursor, keys] = await redis.scanAsync(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        
        // Delete found keys
        if (keys && keys.length > 0) {
          await Promise.all(keys.map(key => redis.delAsync(key)));
          keysDeleted += keys.length;
        }
      } while (cursor !== '0');
      
      logger.debug(`Cleared ${keysDeleted} keys matching pattern: ${pattern}`);
      return keysDeleted;
    } catch (error) {
      logger.error(`Error clearing cache for pattern ${pattern}:`, error);
      return 0;
    }
  }
};

module.exports = cacheService;
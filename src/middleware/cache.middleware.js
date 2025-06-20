// src/middleware/cache.middleware.js
const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');

/**
 * Middleware for caching API responses
 * @param {string} prefix - Cache key prefix
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (prefix, ttl) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests or if caching is disabled
    if (req.method !== 'GET' || req.headers['x-skip-cache'] === 'true') {
      return next();
    }

    try {
      // Generate cache key from request path and query params
      const cacheKey = cacheService.generateKey(
        prefix || req.originalUrl.split('?')[0],
        req.query
      );

      // Check if response is in cache
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData) {
        // Add cache hit header
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cachedData);
      }

      // Cache miss - continue to route handler
      res.setHeader('X-Cache', 'MISS');
      
      // Store original send method
      const originalSend = res.send;
      
      // Override send method to cache the response
      res.send = function(body) {
        // Only cache successful responses
        if (res.statusCode === 200 && body) {
          try {
            const data = JSON.parse(body);
            cacheService.set(cacheKey, data, ttl);
          } catch (e) {
            logger.error('Error caching response:', e);
          }
        }
        
        // Call the original send method
        return originalSend.apply(this, arguments);
      };
      
      next();
    } catch (error) {
      logger.error('Error in cache middleware:', error);
      next();
    }
  };
};

module.exports = cacheMiddleware;
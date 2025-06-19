// src/middleware/cache.middleware.js
// Redis-based caching middleware for high traffic endpoints
// NEW FILE: Added to improve performance under load

const redis = require('redis');
const { promisify } = require('util');
const config = require('../config/config');
const logger = require('../utils/logger');

// Create Redis client
const redisClient = config.REDIS_URL ? redis.createClient(config.REDIS_URL) : null;

// Promisify Redis commands if Redis is enabled
const getAsync = redisClient ? promisify(redisClient.get).bind(redisClient) : null;
const setAsync = redisClient ? promisify(redisClient.set).bind(redisClient) : null;
const delAsync = redisClient ? promisify(redisClient.del).bind(redisClient) : null;
const keysAsync = redisClient ? promisify(redisClient.keys).bind(redisClient) : null;

// Redis error handling
if (redisClient) {
  redisClient.on('error', (error) => {
    logger.error('Redis client error', { error: error.message });
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });
}

/**
 * In-memory cache as a fallback when Redis is not available
 */
const memoryCache = {
  data: {},
  
  get(key) {
    const item = this.data[key];
    if (item && item.expiry > Date.now()) {
      return item.value;
    }
    delete this.data[key];
    return null;
  },
  
  set(key, value, expiryInSeconds) {
    this.data[key] = {
      value,
      expiry: Date.now() + (expiryInSeconds * 1000)
    };
  },
  
  del(key) {
    delete this.data[key];
  },
  
  keys(pattern) {
    // Simple pattern matching (only supports '*' at end)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return Object.keys(this.data).filter(key => key.startsWith(prefix));
    }
    return Object.keys(this.data).filter(key => key === pattern);
  },
  
  // Clean expired items every minute
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      Object.entries(this.data).forEach(([key, item]) => {
        if (item.expiry <= now) {
          delete this.data[key];
        }
      });
    }, 60000);
  }
};

// Start the cleanup process immediately if using memory cache
if (!redisClient) {
  memoryCache.startCleanup();
  logger.info('Using in-memory cache (Redis not configured)');
}

/**
 * Create cache middleware
 * @param {number} duration - Cache duration in seconds
 * @param {function} keyGenerator - Function to generate cache key from request
 * @returns {function} Express middleware
 */
function cacheMiddleware(duration = 60, keyGenerator = req => req.originalUrl) {
  return async (req, res, next) => {
    // Skip cache for non-GET methods
    if (req.method !== 'GET') {
      return next();
    }
    
    // Generate cache key
    const key = typeof keyGenerator === 'function' ? keyGenerator(req) : req.originalUrl;
    
    try {
      // Attempt to get cached data
      let data;
      
      if (redisClient) {
        data = await getAsync(key);
        if (data) {
          data = JSON.parse(data);
        }
      } else {
        data = memoryCache.get(key);
      }
      
      // Set up cache helper methods on response object
      res.locals.cache = data;
      
      res.locals.setCache = async (cKey, cValue, cDuration = duration) => {
        try {
          if (redisClient) {
            await setAsync(cKey, JSON.stringify(cValue), 'EX', cDuration);
          } else {
            memoryCache.set(cKey, cValue, cDuration);
          }
        } catch (error) {
          logger.error('Cache set error', { 
            error: error.message, 
            key: cKey 
          });
        }
      };
      
      res.locals.clearCache = async (pattern) => {
        try {
          if (redisClient) {
            const keys = await keysAsync(pattern);
            if (keys.length) {
              await Promise.all(keys.map(k => delAsync(k)));
            }
          } else {
            const keys = memoryCache.keys(pattern);
            keys.forEach(k => memoryCache.del(k));
          }
        } catch (error) {
          logger.error('Cache clear error', { 
            error: error.message, 
            pattern 
          });
        }
      };
      
      // If we have cached data, return it immediately
      if (data) {
        logger.debug('Cache hit', { key });
        return res.json({
          success: true,
          cached: true,
          ...data
        });
      }
      
      // No cached data, continue to handler but modify response
      const originalSend = res.send;
      res.send = function(body) {
        // Check if response is JSON and successful
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            // Parse response to get data
            const data = JSON.parse(body);
            // Cache only successful responses
            if (data.success) {
              const cacheData = { ...data };
              delete cacheData.success; // Remove success flag as we'll add it back on retrieval
              
              if (redisClient) {
                setAsync(key, JSON.stringify(cacheData), 'EX', duration).catch(err => {
                  logger.error('Redis cache set error', { 
                    error: err.message, 
                    key 
                  });
                });
              } else {
                memoryCache.set(key, cacheData, duration);
              }
            }
          } catch (error) {
            logger.error('Cache parsing error', { 
              error: error.message, 
              key 
            });
          }
        }
        
        // Continue with normal response
        return originalSend.call(this, body);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error', { 
        error: error.message, 
        key 
      });
      next(); // Continue without caching on error
    }
  };
}

module.exports = {
  cacheMiddleware,
  redisClient,
  memoryCache
};
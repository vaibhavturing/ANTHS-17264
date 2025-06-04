// src/middleware/rate-limit.middleware.js

/**
 * Rate limiting middleware with advanced features
 * - Per-user and per-IP rate limiting
 * - Role-based rate limit tiers
 * - Separate limits for different endpoints
 * - Custom response format for rate limit errors
 * - Memory store with Redis option for production
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config/config');
const { ApiError } = require('../utils/errors');
// const { dynamicRateLimiter } = require('./middleware/rate-limit.middleware');
// const securityAuditLogger = require('./middleware/audit-logger.middleware'); // ✅ Ensure this is correctly imported too
const logger = require('../utils/logger');
const { TooManyRequestsError } = require('../utils/errors');


// Initialize Redis client if configured
let redisClient;
if (config.redis?.enabled) {
  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    username: config.redis.username,
    enableAutoPipelining: true
  });
  
  // Handle Redis errors
  redisClient.on('error', (err) => {
    logger.error('Redis error:', err);
  });
}

/**
 * Custom keyGenerator that considers both IP and user ID when available
 * This prevents shared IP attacks and tracks authenticated users properly
 */
const keyGenerator = (req) => {
  // If user is authenticated, use their ID as part of the key
  if (req.user?.id) {
    return `${req.ip}:user_${req.user.id}`;
  }
  // For unauthenticated requests, use IP with a prefix
  return `${req.ip}:anon`;
};

/**
 * Get rate limit options based on user role and route
 * @param {Object} req - Express request object
 * @returns {Object} Rate limit options
 */
const getRateLimitOptions = (req) => {
  // Default limits
  const defaultLimits = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per 15 minutes
  };
  
  // Role-based limits - higher limits for staff roles
  const roleLimits = {
    'patient': { windowMs: 15 * 60 * 1000, max: 100 },
    'doctor': { windowMs: 15 * 60 * 1000, max: 300 },
    'nurse': { windowMs: 15 * 60 * 1000, max: 300 },
    'receptionist': { windowMs: 15 * 60 * 1000, max: 500 },
    'admin': { windowMs: 15 * 60 * 1000, max: 1000 },
    // Default for unauthenticated users or unknown roles
    'default': { windowMs: 15 * 60 * 1000, max: 50 }
  };
  
  // Path-specific limits override role limits
  const pathLimits = {
    // More strict limits for authentication endpoints to prevent brute force
    '/auth/login': { windowMs: 15 * 60 * 1000, max: 10 },
    '/auth/register': { windowMs: 60 * 60 * 1000, max: 5 },
    '/auth/password-reset': { windowMs: 60 * 60 * 1000, max: 5 },
    // More permissive for read-only endpoints
    '/patients': { windowMs: 15 * 60 * 1000, max: 200 },
    '/doctors': { windowMs: 15 * 60 * 1000, max: 200 }
  };
  
  // Get user role from the request
  const userRole = req.user?.role || 'default';
  
  // Find the matching path limit if any
  let pathMatch = null;
  
  const reqPath = req.path.toLowerCase();
  for (const [path, limits] of Object.entries(pathLimits)) {
    if (reqPath.includes(path) || reqPath.startsWith(`/api/${config.apiVersion}${path}`)) {
      pathMatch = limits;
      break;
    }
  }
  
  // Combine limits: path limit overrides role limit, role limit overrides default
  return {
    ...defaultLimits,
    ...(roleLimits[userRole] || roleLimits.default),
    ...(pathMatch || {})
  };
};

/**
 * Dynamic rate limiter middleware that adjusts limits based on user role and route
 */
const dynamicRateLimiter = (req, res, next) => {
  // Get appropriate rate limit options
  const options = getRateLimitOptions(req);
  
  // Configure rate limiter with those options
  const limiter = rateLimit({
    // Use Redis store in production, memory store otherwise
    store: config.redis?.enabled 
      ? new RedisStore({
          // @ts-ignore - Type definitions issue with recent version
          client: redisClient,
          prefix: 'ratelimit:'
        })
      : undefined,
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    // Custom handler for rate limit errors
    handler: (req, res, next, options) => {
      const error = new ApiError(
        'Too many requests, please try again later.',
        429,
        { retryAfter: Math.ceil(options.windowMs / 1000) },
        'RATE_LIMIT_EXCEEDED'
      );
      
      // Log rate limit event
      logger.warn(`Rate limit exceeded for ${req.ip} ${req.user?.id ? `(User: ${req.user.id})` : ''} on ${req.method} ${req.originalUrl}`);
      
      next(error);
    },
    skip: (req) => {
      // Optional: Allow internal requests to bypass rate limiting
      return req.ip === '127.0.0.1' && config.env === 'development';
    }
  });
  
  // Apply the configured limiter
  return limiter(req, res, next);
};

/**
 * Specific rate limiters for different purposes
 */

// General API rate limiter (less restrictive)
const apiLimiter = rateLimit({
  store: config.redis?.enabled
    ? new RedisStore({
        // @ts-ignore - Type definitions issue with recent version
        client: redisClient,
        prefix: 'ratelimit:api:'
      })
    : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next) => {
    next(new ApiError('Too many API requests', 429));
  }
});

// Authentication endpoints limiter (more restrictive)
const authLimiter = rateLimit({
  store: config.redis?.enabled
    ? new RedisStore({
        // @ts-ignore - Type definitions issue with recent version
        client: redisClient,
        prefix: 'ratelimit:auth:'
      })
    : undefined,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next) => {
    next(new ApiError('Too many authentication attempts', 429));
  }
});

// Admin endpoints limiter
const adminLimiter = rateLimit({
  store: config.redis?.enabled
    ? new RedisStore({
        // @ts-ignore - Type definitions issue with recent version
        client: redisClient,
        prefix: 'ratelimit:admin:'
      })
    : undefined,
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  handler: (req, res, next) => {
    next(new ApiError('Too many admin API requests', 429));
  }
});

module.exports = {
  dynamicRateLimiter,
  apiLimiter,
  authLimiter,
  adminLimiter
};
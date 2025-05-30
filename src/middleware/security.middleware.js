/**
 * Healthcare Management Application
 * Security Middleware
 * 
 * Configures various security middleware to protect the application from
 * common web vulnerabilities and attacks
 */

const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const config = require('../config/config');

/**
 * Configure Helmet Security Headers
 * @returns {Function} Configured Helmet middleware
 */
const helmetMiddleware = () => {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
    // Enable in production
    hsts: config.env === 'production',
    // Set very restrictive referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Force all connections over HTTPS in production
    forceSTTP: config.env === 'production',
  });
};

/**
 * Configure CORS settings
 * @returns {Function} Configured CORS middleware
 */
const corsMiddleware = () => {
  return cors({
    // Origins allowed to access the API
    origin: config.corsOrigin,
    // Methods allowed
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    // Headers allowed in requests
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Allow credentials (cookies, authorization headers)
    credentials: true,
    // How long the results of a preflight request can be cached
    maxAge: 86400, // 24 hours
  });
};

/**
 * Configure Rate Limiting
 * @returns {Function} Configured rate limiting middleware
 */
const rateLimitMiddleware = () => {
  return rateLimit({
    // Time window in ms
    windowMs: config.security.rateLimit.windowMs,
    // Max requests per window
    max: config.security.rateLimit.max,
    // Response message when rate limit is exceeded
    message: 'Too many requests from this IP, please try again later',
    // Header names to uses
    standardHeaders: true,
    // Disable X-RateLimit headers
    legacyHeaders: false,
    // Callback function to execute once rate limit is exceeded
    handler: (req, res) => {
      res.status(429).json({
        status: 'error',
        message: 'Too many requests from this IP, please try again later',
        retryAfter: Math.ceil(config.security.rateLimit.windowMs / 1000 / 60), // minutes
      });
    },
  });
};

/**
 * Configure XSS Protection
 * @returns {Function} XSS cleaner middleware
 */
const xssMiddleware = () => {
  return xss();
};

/**
 * Configure NoSQL Injection Protection
 * @returns {Function} MongoDB sanitize middleware
 */
const mongoSanitizeMiddleware = () => {
  return mongoSanitize({
    // Replace prohibited characters with _
    replaceWith: '_',
    // Remove $ and . operators from query
    onSanitize: ({ req, key }) => {
      console.warn(`This request tried to use MongoDB operator in key: ${key}`);
    },
  });
};

/**
 * Configure HTTP Parameter Pollution Protection
 * @returns {Function} HPP middleware
 */
const hppMiddleware = () => {
  // Whitelist of parameters that are allowed to be used multiple times
  const whitelist = [
    'fields', 
    'sort', 
    'page', 
    'limit', 
    'filter',
    'dateFrom',
    'dateTo',
    'status',
    'type',
    'specialties',
    'ids'
  ];

  return hpp({ whitelist });
};

/**
 * Create security headers check middleware
 * @returns {Function} Middleware to verify security headers
 */
const securityHeadersMiddleware = () => {
  return (req, res, next) => {
    // Set security headers not covered by Helmet
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Download-Options', 'noopen');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('X-Permitted-Cross-Domain-Policies', 'none');
    res.set('X-XSS-Protection', '1; mode=block');
    next();
  };
};

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
  xssMiddleware,
  mongoSanitizeMiddleware,
  hppMiddleware,
  securityHeadersMiddleware,
};
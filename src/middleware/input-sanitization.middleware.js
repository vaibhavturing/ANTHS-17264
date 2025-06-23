/**
 * Input Sanitization Middleware
 * File: src/middleware/input-sanitization.middleware.js
 * 
 * This middleware sanitizes all user inputs to prevent injection attacks
 * such as XSS, SQL Injection, NoSQL Injection, and HTML Injection.
 */

const xss = require('xss');
const mongoSanitize = require('express-mongo-sanitize');
const sqlInjection = require('sql-injection');
const logger = require('../utils/logger');

/**
 * Sanitize a value recursively
 * @param {*} value - The value to sanitize
 * @param {Object} options - Sanitization options
 * @returns {*} - Sanitized value
 */
const sanitizeValue = (value, options = {}) => {
  if (value === null || value === undefined) {
    return value;
  }
  
  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item, options));
  }
  
  // Handle objects recursively
  if (typeof value === 'object') {
    const sanitizedObject = {};
    for (const [key, val] of Object.entries(value)) {
      sanitizedObject[key] = sanitizeValue(val, options);
    }
    return sanitizedObject;
  }
  
  // Handle strings
  if (typeof value === 'string') {
    // Skip sanitization for certain fields if needed
    if (options.skipFields && options.field && options.skipFields.includes(options.field)) {
      return value;
    }

    // Apply XSS sanitization
    let sanitized = xss(value, {
      whiteList: {}, // No HTML allowed by default
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script'] // Strip script tags and their content
    });

    // Apply HTML entity encoding for < and > characters to prevent HTML injection
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Remove potentially dangerous SQL patterns
    sanitized = sanitized
      .replace(/(\b)(select|insert|update|delete|drop|alter|create|truncate)(\b)/gi, '$1**blocked**$3')
      .replace(/(\b)(union|join|from|where)(\b)/gi, '$1**blocked**$3')
      .replace(/(--|;|\/\*|\*\/|@@)/g, '**blocked**');

    return sanitized;
  }
  
  // Return other types unchanged
  return value;
};

/**
 * Middleware to sanitize request body, query parameters, and URL parameters
 */
const sanitizeRequestMiddleware = (req, res, next) => {
  try {
    // Configuration for sanitization
    const sanitizeOptions = {
      // Fields to skip sanitization (e.g., HTML content in rich text editor)
      skipFields: ['htmlContent', 'medicalNotes', 'richTextContent']
    };
    
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeValue(req.body, sanitizeOptions);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeValue(req.query, sanitizeOptions);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeValue(req.params, sanitizeOptions);
    }
    
    next();
  } catch (error) {
    logger.error(`Error in input sanitization middleware: ${error.message}`);
    next(error);
  }
};

/**
 * Apply MongoDB sanitization
 */
const mongoSanitizationMiddleware = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`MongoDB injection attempted: ${key} from ${req.ip}`);
  }
});

/**
 * Apply SQL injection protection
 */
const sqlInjectionMiddleware = sqlInjection.check({
  body: true,
  query: true,
  onDetect: (req, res) => {
    logger.warn(`SQL Injection attempt detected from ${req.ip} on ${req.originalUrl}`);
    return res.status(403).json({
      status: 'error',
      message: 'Potentially malicious SQL patterns detected in request',
      code: 'SQL_INJECTION_DETECTED'
    });
  }
});

/**
 * Combined middleware that applies all sanitization techniques
 */
const inputSanitizationMiddleware = [
  mongoSanitizationMiddleware,
  sqlInjectionMiddleware,
  sanitizeRequestMiddleware
];

module.exports = inputSanitizationMiddleware;
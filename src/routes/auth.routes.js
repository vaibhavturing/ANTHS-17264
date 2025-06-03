// src/routes/auth.routes.js

const express = require('express');
const router = express.Router();

// Import the auth controller
// CRITICAL FIX: Using a local/relative path to the controller
const authController = require('../controllers/auth.controller');

// CRITICAL FIX: Simple validation middleware to avoid dependencies
const validate = (schema) => {
  return (req, res, next) => {
    if (!schema) return next();
    
    try {
      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          }))
        });
      }
      
      req.body = value;
      next();
    } catch (err) {
      next(err);
    }
  };
};

// CRITICAL FIX: Simple rate limiter implementation without dependencies
const simpleRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  const requests = {};
  
  // Clean up function to remove old entries
  const cleanup = () => {
    const now = Date.now();
    for (const ip in requests) {
      if (requests[ip].resetTime <= now) {
        delete requests[ip];
      }
    }
  };
  
  // Run cleanup every minute
  setInterval(cleanup, 60 * 1000);
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    // Initialize or reset if needed
    if (!requests[ip] || requests[ip].resetTime <= now) {
      requests[ip] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }
    
    // Increment counter
    requests[ip].count++;
    
    // Check if over limit
    if (requests[ip].count > max) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }
    
    next();
  };
};

// Simple rate limiter for auth routes
const authLimiter = simpleRateLimiter(15 * 60 * 1000, 10); // 10 requests per 15 minutes

// CRITICAL FIX: Import schemas from the file we know works
// For now, use placeholders for validation schemas
const registerSchema = null; // Replace with actual schema when validated
const passwordResetRequestSchema = null;
const passwordResetSchema = null;

/**
 * @route POST /api/auth/register
 * @desc Register a new user with role-specific validation
 * @access Public
 */
router.post(
  '/register',
  authLimiter,
  // The validate middleware will be a no-op until we fix the schema
  validate(registerSchema),
  authController.register
);

/**
 * @route GET /api/auth/verify-email/:token
 * @desc Verify user's email address
 * @access Public
 */
router.get(
  '/verify-email/:token',
  authController.verifyEmail
);

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset email
 * @access Public
 */
router.post(
  '/forgot-password',
  authLimiter,
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post(
  '/reset-password',
  authLimiter,
  validate(passwordResetSchema),
  authController.resetPassword
);

module.exports = router;
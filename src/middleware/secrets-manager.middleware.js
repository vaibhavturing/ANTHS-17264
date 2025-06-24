// src/middleware/secrets-manager.middleware.js

const secretsService = require('../services/secrets.service');
const logger = require('../utils/logger');

/**
 * Middleware to initialize secrets service
 * Must be applied early in the middleware chain
 * @param {Object} _req - Express request object
 * @param {Object} _res - Express response object
 * @param {Function} next - Next middleware function
 * @returns {Promise<void>}
 */
const initializeSecretsMiddleware = async (_req, _res, next) => {
  try {
    if (!secretsService.initialized) {
      await secretsService.initialize();
    }
    next();
  } catch (error) {
    logger.error(`Secrets initialization failed: ${error.message}`, { error });
    next(new Error('Application failed to initialize secrets'));
  }
};

/**
 * Middleware to periodically check for secret rotation
 * Only checks a small percentage of requests to minimize API calls
 * @param {Object} _req - Express request object
 * @param {Object} _res - Express response object
 * @param {Function} next - Next middleware function
 * @returns {void}
 */
const checkSecretRotationMiddleware = (_req, _res, next) => {
  // Only check on 1% of requests to minimize API calls
  if (Math.random() < 0.01) {
    // Run asynchronously to not block the request
    secretsService.checkForRotation()
      .catch(error => {
        logger.warn(`Secret rotation check failed: ${error.message}`);
      });
  }
  next();
};

module.exports = {
  initializeSecretsMiddleware,
  checkSecretRotationMiddleware
};
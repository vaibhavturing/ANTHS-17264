// src/config/config.js

/**
 * Enhanced application configuration with security settings
 * and robust environment validation/loading.
 */

const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');
const logger = require('../utils/logger');
const { envSchema } = require('../utils/envSchema');

// Determine environment from NODE_ENV
const environment = process.env.NODE_ENV || 'development';

// Resolve expected .env path
const envFile = path.resolve(process.cwd(), `.env.${environment}`);
const fallbackEnvFile = path.resolve(process.cwd(), `.env`);

// Load .env file based on environment
let envResult = dotenv.config({ path: envFile });
if (envResult.error) {
  logger.warn(`⚠️  Environment file not found at ${envFile}, falling back to .env`);
  envResult = dotenv.config({ path: fallbackEnvFile });
}

if (envResult.error) {
  logger.error('❌ Failed to load any .env file. Environment variables may be missing.');
}

// Define validation schema for environment variables
const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .default('development'),
    PORT: Joi.number().default(5000),
    API_VERSION: Joi.string().default('v1'),

    // Database configuration
    MONGODB_URI: Joi.string().required()
      .description('MongoDB connection string'),
    MONGODB_DB_NAME: Joi.string()
      .description('MongoDB database name'),
    MONGODB_POOL_SIZE: Joi.number()
      .default(10)
      .description('MongoDB connection pool size'),
    MONGODB_MAX_RETRIES: Joi.number()
      .default(5)
      .description('MongoDB max connection retry attempts'),
    MONGODB_RETRY_INTERVAL: Joi.number()
      .default(5000)
      .description('MongoDB retry interval in ms'),
    MONGODB_HEALTH_CHECK_INTERVAL: Joi.number()
      .default(30000)
      .description('MongoDB health check interval in ms'),

    // JWT configuration
    JWT_SECRET: Joi.string().required()
      .description('JWT secret key'),
    JWT_ACCESS_EXPIRATION: Joi.string()
      .default('1h')
      .description('JWT access token expiration time'),
    JWT_REFRESH_EXPIRATION: Joi.string()
      .default('7d')
      .description('JWT refresh token expiration time'),

    // Logging configuration
    LOG_LEVEL: Joi.string()
      .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
      .default('info')
      .description('Log level'),
    LOG_FORMAT: Joi.string()
      .valid('combined', 'common', 'dev', 'short', 'tiny')
      .default('dev')
      .description('Log format for HTTP requests'),

    // Redis configuration
    REDIS_ENABLED: Joi.boolean().default(false),
    REDIS_HOST: Joi.string().when('REDIS_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    REDIS_PORT: Joi.number().when('REDIS_ENABLED', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    REDIS_PASSWORD: Joi.string().allow('').optional(),
    REDIS_USERNAME: Joi.string().allow('').optional(),

    // Security configuration
    CORS_WHITELIST: Joi.string()
      .description('Comma separated list of allowed origins for CORS'),
    ADMIN_IP_WHITELIST: Joi.string()
      .description('Comma separated list of allowed IPs for admin operations'),
    IP_WHITELIST: Joi.string()
      .description('Comma separated list of allowed IPs for sensitive operations'),
    RATE_LIMIT_WINDOW_MS: Joi.number()
      .default(900000)
      .description('Rate limiting window in milliseconds (default: 15 minutes)'),
    RATE_LIMIT_MAX: Joi.number()
      .default(100)
      .description('Maximum requests per rate limit window'),
    SECURITY_CONTACT_EMAIL: Joi.string()
      .email()
      .description('Email address for security issues'),

    // Feature flags
    FEATURE_TELEMEDICINE: Joi.boolean().default(false),
    FEATURE_ANALYTICS: Joi.boolean().default(false),
    FEATURE_AUDIT_LOGGING: Joi.boolean().default(true),
  })
  .unknown();

// Validate environment variables
const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  logger.error('❌ Invalid environment variables:');
  error.details.forEach(detail => logger.error(`- ${detail.message}`));
  throw new Error(`Config validation failed`);
}

// Parse string arrays from environment variables
const parseStringArray = (envStr) => {
  if (!envStr) return [];
  return envStr.split(',').map(item => item.trim());
};

// Build config object
const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  apiVersion: envVars.API_VERSION,

  db: {
    uri: envVars.MONGODB_URI,
    dbName: envVars.MONGODB_DB_NAME,
    poolSize: envVars.MONGODB_POOL_SIZE,
    maxRetries: envVars.MONGODB_MAX_RETRIES,
    retryInterval: envVars.MONGODB_RETRY_INTERVAL,
    healthCheckInterval: envVars.MONGODB_HEALTH_CHECK_INTERVAL
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpiration: envVars.JWT_ACCESS_EXPIRATION,
    refreshExpiration: envVars.JWT_REFRESH_EXPIRATION
  },

  logging: {
    level: envVars.LOG_LEVEL,
    format: envVars.LOG_FORMAT,
    logResponses: envVars.NODE_ENV !== 'production'
  },

  redis: {
    enabled: envVars.REDIS_ENABLED,
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT,
    password: envVars.REDIS_PASSWORD,
    username: envVars.REDIS_USERNAME
  },

  security: {
    cors: {
      whitelist: parseStringArray(envVars.CORS_WHITELIST)
    },
    adminIpWhitelist: parseStringArray(envVars.ADMIN_IP_WHITELIST),
    ipWhitelist: parseStringArray(envVars.IP_WHITELIST),
    rateLimit: {
      windowMs: envVars.RATE_LIMIT_WINDOW_MS,
      max: envVars.RATE_LIMIT_MAX
    },
    contactEmail: envVars.SECURITY_CONTACT_EMAIL
  },

  features: {
    telemedicine: envVars.FEATURE_TELEMEDICINE,
    analytics: envVars.FEATURE_ANALYTICS,
    auditLogging: envVars.FEATURE_AUDIT_LOGGING
  }
};

// Log final DB URI for confirmation
if (!config.db.uri) {
  logger.error('❌ Missing MongoDB URI in config.');
} else {
  logger.debug(`✅ Loaded MongoDB URI: ${config.db.uri}`);
}

module.exports = config;

const path = require('path');
const dotenv = require('dotenv');
const Joi = require('joi');
const logger = require('../utils/logger');

// Determine environment from NODE_ENV
const environment = process.env.NODE_ENV || 'development';

// Load environment variables based on the environment
const envFile = path.resolve(process.cwd(), `.env.${environment}`);
const envResult = dotenv.config({ path: envFile });

if (envResult.error) {
  logger.warn(`Environment file not found at ${envFile}, using .env file`);
  dotenv.config(); // Load default .env file as fallback
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

    // Security / Rate limit configuration (optional, can be set via env)
    RATE_LIMIT_WINDOW_MS: Joi.number()
      .default(15 * 60 * 1000)
      .description('Rate limit window in ms'),
    RATE_LIMIT_MAX: Joi.number()
      .default(100)
      .description('Max requests per window per IP'),
  })
  .unknown();

// Validate environment variables against schema
const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Construct the config object
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
    format: envVars.LOG_FORMAT
  },

  security: {
    rateLimit: {
      windowMs: envVars.RATE_LIMIT_WINDOW_MS,
      max: envVars.RATE_LIMIT_MAX
    }
  }
};

module.exports = config;
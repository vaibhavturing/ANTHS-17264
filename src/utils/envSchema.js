/**
 * Healthcare Management Application
 * Environment Variables Schema Validation
 */

const Joi = require('joi');

// Schema for environment variable validation
const envSchema = Joi.object()
  .keys({
    // Server Configuration
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .required(),
    PORT: Joi.number().default(3000),
    API_URL: Joi.string().uri().required(),
    CORS_ORIGIN: Joi.string().required(),

    // MongoDB Configuration
    MONGO_URI: Joi.string().required().description('MongoDB connection string'),
    MONGO_OPTIONS: Joi.string().default('retryWrites=true&w=majority'),

    // JWT Configuration
    JWT_SECRET: Joi.string().required().min(20),
    JWT_EXPIRES_IN: Joi.string().required(),
    JWT_COOKIE_EXPIRES_IN: Joi.number().required(),

    // Logging
    LOG_LEVEL: Joi.string()
      .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
      .default('info'),
    LOG_TO_FILE: Joi.boolean().default(false),

    // Security
    BCRYPT_SALT_ROUNDS: Joi.number().default(10),
    RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
    RATE_LIMIT_MAX: Joi.number().default(100),

    // Email Configuration
    SMTP_HOST: Joi.string().required(),
    SMTP_PORT: Joi.number().required(),
    SMTP_USERNAME: Joi.string().required(),
    SMTP_PASSWORD: Joi.string().required(),
    EMAIL_FROM: Joi.string().email().required(),

    // Third-party APIs
    PAYMENT_GATEWAY_API_KEY: Joi.string().required(),
    NOTIFICATION_SERVICE_KEY: Joi.string().required()
  })
  .unknown();

module.exports = { envSchema };
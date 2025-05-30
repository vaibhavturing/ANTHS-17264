/**
 * Healthcare Management Application
 * Configuration Manager
 * 
 * Loads and validates environment variables for the application
 */

const dotenv = require('dotenv');
const path = require('path');
const { envSchema } = require('../utils/envSchema');
const logger = require('../utils/logger');

// Determine which .env file to load based on NODE_ENV
const getEnvPath = () => {
  const env = process.env.NODE_ENV || 'development';
  
  // Map environment to corresponding .env file
  const envMap = {
    development: '.env.development',
    test: '.env.test',
    production: '.env.production'
  };

  // Default to .env if specific file doesn't exist
  return envMap[env] || '.env';
};

// Load environment variables from the appropriate .env file
const loadEnvVariables = () => {
  const envPath = path.resolve(process.cwd(), getEnvPath());
  
  // Load environment variables from file
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    // Fallback to default .env if specific environment file is not found
    const defaultEnvPath = path.resolve(process.cwd(), '.env');
    dotenv.config({ path: defaultEnvPath });
    
    // Only throw error when no .env files can be found
    if (result.error.code === 'ENOENT' && !require('fs').existsSync(defaultEnvPath)) {
      throw new Error(`Environment file not found: ${envPath} or .env`);
    }
  }
};

// Validate environment variables against schema
const validateEnvVariables = () => {
  const { error, value } = envSchema.validate(process.env, {
    allowUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const missingKeys = error.details.map(detail => detail.message).join('\n');
    throw new Error(`Environment validation failed:\n${missingKeys}`);
  }

  return value;
};

// Initialize configuration
const initializeConfig = () => {
  try {
    // Load variables from appropriate .env file
    loadEnvVariables();
    
    // Validate the environment variables
    const config = validateEnvVariables();
    
    // Log successful loading (without sensitive data)
    logger.info(`Configuration loaded for ${config.NODE_ENV} environment`);
    
    return {
      // Server
      env: config.NODE_ENV,
      port: config.PORT,
      apiUrl: config.API_URL,
      corsOrigin: config.CORS_ORIGIN.split(','),
      
      // Database
      database: {
        uri: config.MONGO_URI,
        options: config.MONGO_OPTIONS,
      },
      
      // JWT Authentication
      jwt: {
        secret: config.JWT_SECRET,
        expiresIn: config.JWT_EXPIRES_IN,
        cookieExpiresIn: config.JWT_COOKIE_EXPIRES_IN,
      },
      
      // Logging
      logging: {
        level: config.LOG_LEVEL,
        toFile: config.LOG_TO_FILE === 'true',
      },
      
      // Security
      security: {
        bcryptSaltRounds: parseInt(config.BCRYPT_SALT_ROUNDS, 10),
        rateLimit: {
          windowMs: parseInt(config.RATE_LIMIT_WINDOW_MS, 10),
          max: parseInt(config.RATE_LIMIT_MAX, 10),
        },
      },
      
      // Email
      email: {
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        auth: {
          user: config.SMTP_USERNAME,
          pass: config.SMTP_PASSWORD,
        },
        from: config.EMAIL_FROM,
      },
      
      // Third-party APIs
      apis: {
        paymentGateway: config.PAYMENT_GATEWAY_API_KEY,
        notificationService: config.NOTIFICATION_SERVICE_KEY,
      },
    };
  } catch (error) {
    logger.error(`Configuration error: ${error.message}`);
    process.exit(1);
  }
};

// Export the configuration
const config = initializeConfig();

module.exports = config;
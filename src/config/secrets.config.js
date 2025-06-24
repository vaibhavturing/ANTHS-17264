// src/config/secrets.config.js

/**
 * Secrets Management Configuration
 * This file configures how the application accesses secrets and API keys.
 * No actual secrets are stored here - they are retrieved from AWS Secrets Manager.
 */
module.exports = {
  // AWS Secrets Manager configuration
  aws: {
    // Region for Secrets Manager
    region: process.env.AWS_REGION || 'us-east-1',
    
    // Secret prefix for environment-specific secrets
    secretPrefix: `healthcare-app-${process.env.NODE_ENV || 'development'}`,
    
    // Cache settings for secrets to reduce API calls
    cache: {
      enabled: true,
      ttlSeconds: 300 // Cache secrets for 5 minutes
    },
    
    // Retry configuration for failed secret retrievals
    retry: {
      maxRetries: 3,
      retryDelayMs: 1000
    }
  },
  
  // Secret key mapping - maps internal key names to AWS secret paths
  // This allows changing the secret path without changing application code
  secretMapping: {
    // Authentication secrets
    'auth.jwt.secret': '/auth/jwt/secret',
    'auth.jwt.refreshSecret': '/auth/jwt/refreshSecret',
    
    // Database credentials
    'database.postgres.password': '/database/postgres/password',
    'database.mongodb.password': '/database/mongodb/password',
    'database.redis.password': '/database/redis/password',
    
    // External API keys
    'api.google.maps': '/external/google/maps',
    'api.sendgrid.key': '/external/sendgrid/key',
    'api.twilio.accountSid': '/external/twilio/accountSid',
    'api.twilio.authToken': '/external/twilio/authToken',
    'api.stripe.secretKey': '/external/stripe/secretKey',
    'api.stripe.webhookSecret': '/external/stripe/webhookSecret',
    
    // Storage credentials
    's3.accessKeyId': '/storage/s3/accessKeyId',
    's3.secretAccessKey': '/storage/s3/secretAccessKey',
    
    // Encryption keys
    'encryption.aes.primaryKey': '/encryption/aes/primaryKey',
    'encryption.aes.secondaryKey': '/encryption/aes/secondaryKey',
    
    // HIPAA compliance
    'hipaa.dataEncryption.key': '/hipaa/dataEncryption/key',
    
    // Backup encryption
    'backup.encryption.key': '/backup/encryption/key'
  },
  
  // Required secrets that the application needs to function
  requiredSecrets: [
    'auth.jwt.secret',
    'database.postgres.password',
    'database.mongodb.password',
    'encryption.aes.primaryKey'
  ],
  
  // Secret rotation settings
  rotation: {
    // Paths of secrets that support automatic rotation
    rotatable: [
      'auth.jwt.secret',
      'encryption.aes.primaryKey',
      'api.sendgrid.key',
      'api.stripe.secretKey'
    ],
    // Secrets that require application restart when rotated
    requireRestart: [
      'database.postgres.password',
      'database.mongodb.password'
    ]
  },
  
  // Local development fallbacks (only used in development)
  // These are not used in staging or production environments
  localDevelopment: {
    enabled: process.env.NODE_ENV === 'development',
    // Vault file path for local development secrets
    vaultPath: './.vault/secrets.json',
    // Whether to allow missing secrets to be created in development
    allowCreate: true
  }
};
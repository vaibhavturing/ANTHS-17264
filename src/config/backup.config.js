// src/config/backup.config.js

/**
 * Backup Configuration
 * This file contains settings for automatic daily backups and restore testing
 * All backups are encrypted using AES-256 encryption before storage
 */
module.exports = {
  // AWS S3 bucket configuration
  s3: {
    bucket: process.env.BACKUP_S3_BUCKET || 'healthcare-app-backups',
    region: process.env.BACKUP_S3_REGION || 'us-east-1',
    encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
    // Key prefix structure: healthcare-app/environment/backup-type/date
    keyPrefix: 'healthcare-app',
  },

  // PostgreSQL database backup configuration
  postgres: {
    database: process.env.POSTGRES_DB || 'healthcare_db',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST || 'postgres',
    port: process.env.POSTGRES_PORT || 5432,
    dumpOptions: {
      // Additional pg_dump options
      format: 'custom', // Use custom format for optimal restoration
      blobs: true, // Include large objects
      clean: true, // Clean (drop) database objects before recreating
      if_exists: true, // Use IF EXISTS when dropping objects
      create: true, // Include commands to create database in dump
    }
  },

  // MongoDB database backup configuration
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare',
    authSource: 'admin',
    username: process.env.MONGO_ROOT_USER,
    password: process.env.MONGO_ROOT_PASSWORD,
    dumpOptions: {
      // Additional mongodump options
      gzip: true // Compress the backup
    }
  },

  // File system backup configuration (for uploaded files, etc.)
  fileSystem: {
    paths: [
      '/app/uploads', 
      '/app/public/user-content',
      '/app/config/certificates'
    ],
    excludePaths: [
      'node_modules',
      'tmp',
      '.git'
    ]
  },

  // Backup scheduling and retention
  schedule: {
    // Daily full backup schedule (cron format)
    daily: '0 1 * * *', // Every day at 1:00 AM
    // Incremental backup schedule (captures changes between full backups)
    incremental: '0 */6 * * *', // Every 6 hours
    // Monthly backup retention schedule (1st of every month at 12:30 AM)
    monthlyRetention: '30 0 1 * *',
    // Test restore schedule (15th of every month at 2:00 AM)
    testRestore: '0 2 15 * *',
  },

  // Backup retention policy
  retention: {
    // How long to keep daily backups
    daily: 14, // days
    // How long to keep weekly backups (created on Sundays)
    weekly: 5, // weeks
    // How long to keep monthly backups (created on the 1st)
    monthly: 12, // months
    // How long to keep yearly backups (created on Jan 1st)
    yearly: 7, // years
  },

  // Notifications
  notifications: {
    email: {
      enabled: true,
      recipients: [
        'admin@healthcare-app.com',
        'security@healthcare-app.com'
      ],
      onSuccess: true,
      onFailure: true,
    },
    slack: {
      enabled: true,
      webhook: process.env.BACKUP_SLACK_WEBHOOK,
      channel: '#backup-alerts',
      onSuccess: false, // Only notify on failure by default
      onFailure: true,
    }
  },

  // Backup encryption
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm', // Use AES-256-GCM for authenticated encryption
    keyRotation: true, // Enable key rotation
    keyRotationFrequency: 90, // days
  },

  // Backup verification
  verification: {
    enabled: true,
    checksumAlgorithm: 'sha256', // Use SHA-256 for checksums
    validateAfterUpload: true, // Verify checksums after upload
  },

  // Restore testing
  restoreTesting: {
    // Environment for test restores (not production)
    environment: 'test-restore',
    // Verify data integrity after restore
    verifyDataIntegrity: true,
    // Number of random records to verify
    sampleSize: 100,
    // Send results to monitoring system
    monitoringEndpoint: process.env.BACKUP_MONITORING_ENDPOINT
  },
  
  // Backup metrics and logging
  logging: {
    level: process.env.BACKUP_LOG_LEVEL || 'info',
    destination: '/var/log/healthcare-app/backups.log',
    metrics: {
      enabled: true,
      provider: 'prometheus', // Use Prometheus for metrics
      endpoint: '/metrics/backups'
    }
  }
};
/**
 * Security Configuration
 * File: src/config/security.config.js
 * 
 * This file contains centralized security configuration settings for monitoring,
 * alerts, and record access thresholds.
 */

const securityConfig = {
  // Record access monitoring thresholds
  monitoring: {
    // Thresholds for record access counts per 5-minute window
    recordAccessThresholds: {
      default: { medium: 50, high: 100, critical: 200 },
      patient: { medium: 30, high: 60, critical: 120 },
      medicalRecord: { medium: 25, high: 50, critical: 100 },
      prescription: { medium: 40, high: 80, critical: 150 },
      appointment: { medium: 45, high: 90, critical: 180 }
    },
    
    // Thresholds for record access rates (records/minute)
    recordAccessRateThresholds: {
      default: { medium: 10, high: 20, critical: 40 },
      patient: { medium: 6, high: 12, critical: 30 },
      medicalRecord: { medium: 5, high: 10, critical: 25 },
      prescription: { medium: 8, high: 15, critical: 35 },
      appointment: { medium: 9, high: 18, critical: 36 }
    },
    
    // Login attempt thresholds
    loginAttemptThresholds: {
      // Number of failed attempts before account lockout
      maxFailedAttempts: 5,
      // Time window for counting failed attempts (in minutes)
      timeWindowMinutes: 30,
      // Account lockout duration (in minutes)
      lockoutDurationMinutes: 30
    }
  },
  
  // Alert configuration
  alerting: {
    // Whether to send alerts for various event types
    enableAlertsFor: {
      failedLogins: true,
      accountLockouts: true,
      accessViolations: true,
      highVolumeAccess: true,
      suspiciousActivity: true
    },
    
    // Minimum severity level for sending alerts
    minimumSeverity: 'medium',
    
    // Alert delivery channels
    channels: {
      email: true,
      inApp: true,
      sms: {
        enabled: true,
        // Send SMS only for these severity levels
        severityLevels: ['high', 'critical']
      },
      push: {
        enabled: true,
        // Send push only for these severity levels
        severityLevels: ['high', 'critical']
      }
    },
    
    // Throttling to prevent alert fatigue
    throttling: {
      enabled: true,
      // Maximum alerts of the same type within timeWindow
      maxAlertsPerType: 5,
      // Time window for throttling (in minutes)
      timeWindowMinutes: 15,
      // Still send summary alert when throttled
      sendSummary: true
    }
  },
  
  // IP blocking for suspicious activity
  ipBlocking: {
    enabled: true,
    // Thresholds for blocking IPs
    thresholds: {
      // Block after this many failed logins
      failedLogins: 10,
      // Time window for counting failed logins (in minutes)
      timeWindowMinutes: 30,
      // IP block duration (in minutes)
      blockDurationMinutes: 60
    },
    // IP whitelist (never block these)
    whitelist: [
      '127.0.0.1'
      // Add trusted IPs here
    ]
  },
  
  // Geolocation-based security
  geolocation: {
    enabled: true,
    // Block requests from these countries
    blockedCountries: [],
    // Require additional verification for these countries
    highRiskCountries: []
  },
  
  // Audit logging configuration
  auditLogging: {
    enabled: true,
    // Log these event types
    logEvents: [
      'authentication_failure',
      'authentication_success',
      'access_violation',
      'high_volume_access',
      'data_access',
      'data_modification',
      'configuration_change'
    ],
    // Retention period for logs (in days)
    retentionDays: 90
  }
};

module.exports = securityConfig;
/**
 * Monitoring Configuration
 * Central configuration for monitoring and alerting thresholds
 */

// Environment specific configs
const ENV = process.env.NODE_ENV || 'development';

// Default monitoring thresholds
const DEFAULT_THRESHOLDS = {
  // CPU usage thresholds (percentage)
  cpu: {
    warning: 70,    // Warning threshold
    critical: 85,   // Critical threshold
    interval: 30,   // Check interval in seconds
  },

  // Memory usage thresholds (percentage)
  memory: {
    warning: 75,
    critical: 90,
    interval: 30,
  },

  // API response time thresholds (milliseconds)
  responseTime: {
    warning: 500,
    critical: 1000,
    interval: 10,
  },

  // Database query time thresholds (milliseconds)
  queryTime: {
    warning: 100,
    critical: 500,
    logSlowQueries: true,
  },

  // Business metrics collection intervals (seconds)
  businessMetrics: {
    appointmentsPerMinute: 60,
    patientRegistrationsPerHour: 300,
    prescriptionsPerHour: 300,
    recordAccessFrequency: 600,
    doctorUtilization: 300,
  },

  // Health check intervals (seconds)
  healthChecks: {
    internal: 15,
    external: 60,
  },
};

// Environment-specific overrides
const ENV_THRESHOLDS = {
  development: {
    // More permissive thresholds for development
    cpu: {
      warning: 80,
      critical: 90,
    },
    responseTime: {
      warning: 1000,
      critical: 3000,
    },
  },

  test: {
    // Test environment doesn't need alerting
    alerting: {
      enabled: false,
    },
  },

  production: {
    // Stricter thresholds for production
    responseTime: {
      warning: 300,
      critical: 800,
    },
    queryTime: {
      warning: 50,
      critical: 200,
    },
  },
};

// Alert notification channels
const ALERT_CHANNELS = {
  development: ['console', 'slack-dev'],
  test: ['console'],
  staging: ['console', 'slack-dev', 'email-ops'],
  production: ['console', 'slack-ops', 'email-ops', 'pagerduty'],
};

// Alert escalation paths
const ALERT_ESCALATIONS = {
  warning: {
    channels: ['slack-ops', 'email-ops'],
    delayMinutes: 15,
  },
  critical: {
    channels: ['slack-ops', 'email-ops', 'pagerduty'],
    delayMinutes: 5,
  },
};

// Combine base config with environment overrides
const thresholds = {
  ...DEFAULT_THRESHOLDS,
  ...(ENV_THRESHOLDS[ENV] || {}),
};

// Export monitoring configuration
module.exports = {
  enabled: process.env.MONITORING_ENABLED !== 'false',
  
  // Metrics collection interval in seconds
  collectionInterval: process.env.METRICS_COLLECTION_INTERVAL || 15,
  
  // Enable/disable specific monitoring features
  features: {
    cpuMonitoring: true,
    memoryMonitoring: true,
    responseTimeMonitoring: true,
    databaseMonitoring: true,
    businessMetrics: true,
    healthChecks: true,
  },
  
  // Alert configuration
  alerting: {
    enabled: process.env.ALERTING_ENABLED !== 'false',
    channels: ALERT_CHANNELS[ENV] || ['console'],
    escalations: ALERT_ESCALATIONS,
    
    // Maintenance window configuration
    maintenanceMode: false,
    maintenanceWindow: {
      start: null, // ISO datetime string
      end: null,   // ISO datetime string
      description: '',
    },
    
    // Alerting throttle to prevent floods
    throttle: {
      enabled: true,
      windowMinutes: 15,
      maxAlertsPerWindow: 5,
    },
  },
  
  // Threshold configuration
  thresholds,

  // Prometheus configuration
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED === 'true',
    port: process.env.PROMETHEUS_PORT || 9090,
    endpoint: process.env.PROMETHEUS_ENDPOINT || '/metrics',
  },
  
  // External services configuration
  services: {
    slack: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#alerts',
      username: process.env.SLACK_USERNAME || 'Healthcare-Monitoring',
    },
    email: {
      from: process.env.ALERT_EMAIL_FROM || 'alerts@healthcare-app.com',
      to: process.env.ALERT_EMAIL_TO || 'ops@healthcare-app.com',
      subject: '[Healthcare App] Alert Notification',
    },
    pagerDuty: {
      integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
      serviceId: process.env.PAGERDUTY_SERVICE_ID,
    },
  },
};
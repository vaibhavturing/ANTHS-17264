// src/config/prelaunch-checker.config.js

/**
 * Pre-Launch Checker Configuration
 * This file configures all the pre-launch checks for the Healthcare Management Application
 */
module.exports = {
  // Global configuration
  global: {
    // Whether to halt deployment on check failures
    haltOnFailure: true,
    
    // Notification settings for check failures
    notifications: {
      email: {
        enabled: true,
        recipients: [
          'devops@healthcare-app.com',
          'security@healthcare-app.com',
          'compliance@healthcare-app.com'
        ],
        ccOnSuccess: [
          'management@healthcare-app.com'
        ]
      },
      slack: {
        enabled: true,
        channel: '#deployment-alerts',
        mentionOnFailure: ['@devops-team', '@security-team']
      }
    },
    
    // Timeout settings
    timeouts: {
      // Global timeout for all checks (milliseconds)
      global: 10 * 60 * 1000, // 10 minutes
      // Individual check timeouts (milliseconds)
      perCheck: {
        monitoring: 2 * 60 * 1000, // 2 minutes
        backup: 5 * 60 * 1000, // 5 minutes
        training: 1 * 60 * 1000, // 1 minute
        rollback: 3 * 60 * 1000, // 3 minutes
        security: 1 * 60 * 1000 // 1 minute
      }
    }
  },
  
  // Monitoring check configuration
  monitoring: {
    enabled: true,
    // List of critical monitoring systems to check
    systems: [
      {
        name: 'CloudWatch',
        type: 'aws-cloudwatch',
        alarmNamePrefix: 'Healthcare-App-',
        region: process.env.AWS_REGION || 'us-east-1'
      },
      {
        name: 'Prometheus',
        type: 'prometheus',
        url: process.env.PROMETHEUS_URL || 'http://prometheus:9090',
        requireAlerts: ['node_down', 'high_cpu', 'high_memory', 'api_latency']
      },
      {
        name: 'PagerDuty',
        type: 'pagerduty',
        serviceId: process.env.PAGERDUTY_SERVICE_ID,
        checkOnCall: true
      }
    ],
    // Test alert to send and verify
    testAlert: {
      name: 'prelaunch-test-alert',
      severity: 'info',
      description: 'This is a test alert from the pre-launch checker',
      autoResolve: true,
      timeoutSeconds: 60
    }
  },
  
  // Backup restoration testing configuration
  backup: {
    enabled: true,
    // Whether to perform a full or partial restoration test
    testType: 'partial', // 'full' or 'partial'
    // Test environment for restoration (should be isolated)
    testEnvironment: {
      type: 'docker-compose', // 'docker-compose', 'kubernetes', or 'aws'
      configPath: './docker-compose.test.yml'
    },
    // Data sample to verify after restoration
    verificationSample: {
      // Number of random records to check
      sampleSize: 5,
      // Tables/collections to sample from
      sources: [
        { name: 'users', idField: 'id', type: 'postgres' },
        { name: 'patients', idField: '_id', type: 'mongodb' },
        { name: 'medical_records', idField: '_id', type: 'mongodb' }
      ]
    }
  },
  
  // Staff training verification configuration
  training: {
    enabled: true,
    // Minimum training completion percentage required
    requiredCompletionPercent: 95,
    // Required training modules for deployment
    requiredModules: [
      {
        id: 'hipaa-basics',
        name: 'HIPAA Fundamentals'
      },
      {
        id: 'security-awareness',
        name: 'Security Awareness Training'
      },
      {
        id: 'new-features',
        name: 'New Features Training'
      }
    ],
    // Staff roles required to complete training
    requiredRoles: ['admin', 'physician', 'nurse', 'front-office', 'billing']
  },
  
  // Rollback procedure verification
  rollback: {
    enabled: true,
    // Rollback strategy to verify
    strategy: 'blue-green', // 'blue-green', 'canary', or 'simple'
    // Test rollback process in staging environment
    stagingCheck: {
      enabled: true,
      // URL of staging environment
      url: process.env.STAGING_URL || 'https://staging.healthcare-app.com',
      // Time to wait for staging to be ready (milliseconds)
      waitTimeMs: 30 * 1000, // 30 seconds
      // Health check endpoint to verify rollback
      healthCheckEndpoint: '/api/health'
    },
    // Verify rollback documentation exists and is up-to-date
    documentation: {
      requiredFiles: [
        'docs/rollback-procedure.md',
        'scripts/rollback.sh'
      ],
      // Maximum age of rollback docs before warning
      maxAgeInDays: 30
    }
  },
  
  // Security review scheduling
  security: {
    enabled: true,
    // Calendar service to use for scheduling
    calendarService: 'google-calendar', // 'google-calendar', 'outlook', or 'ical'
    // Calendar ID to schedule in
    calendarId: process.env.SECURITY_CALENDAR_ID,
    // Days after deployment to schedule review
    reviewDaysAfterDeployment: 30,
    // Required attendees for the security review
    requiredAttendees: [
      'security-team@healthcare-app.com',
      'compliance-officer@healthcare-app.com',
      'development-lead@healthcare-app.com'
    ],
    // Optional attendees for the security review
    optionalAttendees: [
      'management@healthcare-app.com'
    ],
    // Duration of the security review meeting (minutes)
    durationMinutes: 90,
    // Security review template
    reviewTemplate: {
      title: 'Healthcare App 30-Day Security Review',
      description: 'Post-deployment security review to evaluate security posture, analyze logs, and address any identified issues.',
      agenda: [
        'Security incident review',
        'Log analysis findings',
        'Vulnerability scan results',
        'User access audit',
        'Performance and anomaly discussion',
        'Action items'
      ]
    }
  },
  
  // Post-launch verification configuration
  postLaunch: {
    enabled: true,
    // Verification timing after deployment
    timing: {
      initial: 5 * 60 * 1000, // 5 minutes after deployment
      intervals: [
        15 * 60 * 1000, // 15 minutes
        1 * 60 * 60 * 1000, // 1 hour
        24 * 60 * 60 * 1000 // 24 hours
      ]
    },
    // Health checks to perform
    healthChecks: [
      {
        name: 'API Health',
        endpoint: '/api/health',
        expectedStatus: 200,
        maxLatencyMs: 500
      },
      {
        name: 'Database Connectivity',
        endpoint: '/api/health/database',
        expectedStatus: 200
      },
      {
        name: 'Authentication',
        endpoint: '/api/health/auth',
        expectedStatus: 200
      }
    ],
    // Traffic verification
    traffic: {
      // Expected minimum requests per minute
      minRequestsPerMinute: 10,
      // Maximum error rate allowed
      maxErrorRatePercent: 1.0
    }
  }
};
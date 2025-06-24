// src/config/hipaa.config.js

/**
 * HIPAA Compliance Configuration
 * This file contains settings for HIPAA compliance features
 */
module.exports = {
  // Privacy team members for incident reporting
  privacyOfficer: {
    name: 'Jane Smith',
    title: 'Chief Privacy Officer',
    email: 'privacy.officer@healthcare-app.com',
    phone: '+1-555-123-4567'
  },

  // Privacy team members
  privacyTeam: [
    {
      id: 'privacy-admin-1',
      name: 'John Doe',
      title: 'Privacy Administrator',
      email: 'john.doe@healthcare-app.com',
      phone: '+1-555-123-4568'
    },
    {
      id: 'privacy-admin-2',
      name: 'Alice Johnson',
      title: 'Security Administrator',
      email: 'alice.johnson@healthcare-app.com',
      phone: '+1-555-123-4569'
    }
  ],

  // Compliance team members
  complianceTeam: [
    {
      id: 'compliance-officer',
      name: 'Robert Brown',
      title: 'Compliance Officer',
      email: 'robert.brown@healthcare-app.com',
      phone: '+1-555-123-4570'
    },
    {
      id: 'legal-counsel',
      name: 'Sarah Williams',
      title: 'Legal Counsel',
      email: 'sarah.williams@healthcare-app.com',
      phone: '+1-555-123-4571'
    }
  ],

  // Application URL for generating links
  appUrl: process.env.APP_URL || 'https://healthcare-app.com',

  // Breach notification settings
  breachNotification: {
    templates: {
      patientNotification: 'breach-patient-notification',
      hhsNotification: 'breach-hhs-notification',
      mediaNotification: 'breach-media-notification'
    },
    hhsPortalUrl: 'https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf',
    notificationTimeframe: 60 // days
  },

  // PHI access control settings
  phiAccess: {
    // Session timeout in minutes
    sessionTimeout: 15,
    // Require re-authentication for sensitive operations
    requireReauthFor: [
      'bulk-export',
      'patient-delete',
      'admin-functions',
      'sensitive-diagnoses'
    ],
    // Access auditing
    auditFrequency: {
      standardUser: 30, // days
      privilegedUser: 14 // days
    },
    // Emergency access (break glass)
    emergencyAccess: {
      expires: 24, // hours
      requireJustification: true,
      notifyPrivacyOfficer: true
    }
  },

  // Training requirements
  training: {
    frequency: 365, // days (annual)
    gracePeriod: 30, // days
    requiredModules: [
      'hipaa-basics',
      'phi-handling',
      'security-awareness'
    ],
    passingScore: 85,
    reminders: {
      start: 30, // days before expiration
      frequency: 7 // days
    }
  },

  // Audit logging settings
  auditLogging: {
    // Retention period in days (6 years)
    retentionPeriod: 6 * 365,
    // Whether to include PHI in audit logs
    includePhi: false,
    // Actions that trigger audits
    auditedActions: [
      'phi_access',
      'phi_modify',
      'phi_delete',
      'phi_export',
      'user_login',
      'user_logout',
      'permission_change',
      'admin_action',
      'system_alert'
    ]
  },

  // Security requirements
  security: {
    // Password policy
    passwordPolicy: {
      minLength: 12,
      requireComplexity: true,
      expiryDays: 90,
      preventReuse: 12 // last 12 passwords
    },
    // MFA requirements
    mfaRequiredFor: ['all-staff', 'admin'], // optional: 'all-users' would include patients
    // Automatic account lockout
    accountLockout: {
      threshold: 5, // failed attempts
      duration: 30 // minutes
    },
    // Device security
    deviceSecurity: {
      encryptionRequired: true,
      mobileDeviceManagement: true,
      screenLockRequired: true,
      screenLockTimeout: 5 // minutes
    }
  },

  // Business Associate settings
  businessAssociates: {
    baaRequired: true,
    reviewFrequency: 365, // days
    inventoryCheckFrequency: 90 // days
  }
};
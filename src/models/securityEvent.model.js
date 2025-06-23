/**
 * Security Event Model
 * File: src/models/securityEvent.model.js
 * 
 * UPDATED: Added new event types and fields for enhanced security logging
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const securityEventSchema = new Schema({
  eventType: {
    type: String,
    required: true,
    enum: [
      'suspicious_request', 
      'authentication_failure', 
      'authentication_success',    // Added: Track successful logins
      'access_violation',
      'brute_force_attempt',
      'data_leakage',
      'malicious_upload',
      'unexpected_behavior',
      'security_scan',
      'configuration_change',      // Added: Track security-relevant configuration changes
      'account_lockout',           // Added: Track account lockouts
      'high_volume_access',        // Added: Track suspicious high volume record access
      'suspicious_activity'        // Added: General suspicious activity
    ],
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  source: {
    ip: String,
    userAgent: String,
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    userRole: String,                // Added: User role for easier filtering
    location: {
      country: String,
      region: String,
      city: String,
      coordinates: {
        longitude: Number,
        latitude: Number
      }
    }
  },
  request: {
    method: String,
    path: String,
    query: Schema.Types.Mixed,
    body: Schema.Types.Mixed,
    headers: Schema.Types.Mixed
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical', 'info'],
    required: true,
    index: true
  },
  details: {
    reason: String,
    context: Schema.Types.Mixed,
    timestamp: Date,
    // New fields for high volume access
    recordType: String,             // Added: Type of record accessed
    recordCount: Number,            // Added: Number of records accessed
    timeWindowMinutes: Number,      // Added: Time window in minutes
    userInfo: {                     // Added: User information
      username: String,
      role: String
    },
    // New fields for authentication failures
    username: String,               // Added: Username used in login attempt
    failureType: {                  // Added: Type of authentication failure
      type: String,
      enum: ['invalid_credentials', 'account_inactive', 'account_locked', 'expired_password', 'invalid_token', 'other']
    },
    // New fields for access violations
    resource: String,               // Added: Resource being accessed
    requiredPermission: String,     // Added: Permission required for access
    // New fields for suspicious activity
    activityType: String           // Added: Type of suspicious activity
  },
  handled: {
    status: {
      type: String,
      enum: ['unhandled', 'in_progress', 'resolved', 'false_positive'],
      default: 'unhandled',
      index: true
    },
    handledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    handledAt: Date,
    notes: String
  },
  // New field to track whether an alert was sent
  alertSent: {                     // Added: Track if alert was sent
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
securityEventSchema.index({ 'source.ip': 1, eventType: 1, timestamp: -1 });
securityEventSchema.index({ eventType: 1, severity: 1, timestamp: -1 });
securityEventSchema.index({ 'details.username': 1, eventType: 1, timestamp: -1 });
securityEventSchema.index({ 'details.recordType': 1, eventType: 1, timestamp: -1 });

// Add static method to find pattern of failed logins
securityEventSchema.statics.findFailedLoginPattern = async function(ip, username, hours = 24) {
  const timeAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const query = {
    eventType: 'authentication_failure',
    timestamp: { $gte: timeAgo }
  };
  
  if (ip) query['source.ip'] = ip;
  if (username) query['details.username'] = username;
  
  return this.find(query).sort({ timestamp: -1 });
};

// Add static method to find high volume access events
securityEventSchema.statics.findHighVolumeAccess = async function(options = {}) {
  const query = {
    eventType: 'high_volume_access'
  };
  
  if (options.severity) {
    query.severity = options.severity;
  }
  
  if (options.userId) {
    query['source.userId'] = options.userId;
  }
  
  if (options.recordType) {
    query['details.recordType'] = options.recordType;
  }
  
  const timeAgo = options.days 
    ? new Date(Date.now() - options.days * 24 * 60 * 60 * 1000)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  query.timestamp = { $gte: timeAgo };
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 50);
};

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
/**
 * Security Event Model
 * File: src/models/securityEvent.model.js
 * 
 * Model for tracking security events and suspicious activities
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
      'access_violation',
      'brute_force_attempt',
      'data_leakage',
      'malicious_upload',
      'unexpected_behavior',
      'security_scan'
    ]
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  source: {
    ip: String,
    userAgent: String,
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
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
    enum: ['low', 'medium', 'high', 'critical'],
    required: true
  },
  details: {
    reason: String,
    context: Schema.Types.Mixed,
    timestamp: Date
  },
  handled: {
    status: {
      type: String,
      enum: ['unhandled', 'in_progress', 'resolved', 'false_positive'],
      default: 'unhandled'
    },
    handledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    handledAt: Date,
    notes: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
securityEventSchema.index({ eventType: 1, timestamp: -1 });
securityEventSchema.index({ 'source.ip': 1 });
securityEventSchema.index({ severity: 1 });
securityEventSchema.index({ 'handled.status': 1 });

module.exports = mongoose.model('SecurityEvent', securityEventSchema);
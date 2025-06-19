// src/models/auditLog.model.js
// HIPAA-Compliant Audit Log Model
// NEW FILE: Implementing database storage for immutable audit logs

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

/**
 * Audit Log Schema for HIPAA Compliance
 * 
 * Features:
 * - Crypto hash for tamper detection
 * - Hash chaining for log sequence verification
 * - Comprehensive event metadata
 * - Read-only by default
 */
const auditLogSchema = new mongoose.Schema({
  // When the event occurred
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    immutable: true,
    index: true
  },
  
  // Type of action performed
  action: {
    type: String,
    required: true,
    immutable: true,
    index: true
  },
  
  // Data related to the event (will vary by action type)
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    immutable: true
  },
  
  // Who performed the action
  actor: {
    userId: {
      type: String,
      required: true,
      immutable: true,
      index: true
    },
    userName: {
      type: String,
      required: true,
      immutable: true
    },
    role: {
      type: String,
      required: true,
      immutable: true,
      index: true
    },
    ipAddress: {
      type: String,
      required: true,
      immutable: true
    }
  },
  
  // What resource was affected
  resource: {
    type: {
      type: String,
      required: true,
      immutable: true,
      index: true
    },
    id: {
      type: String,
      required: true,
      immutable: true,
      index: true
    }
  },
  
  // Technical metadata
  systemMetadata: {
    hostname: {
      type: String,
      immutable: true
    },
    processId: {
      type: Number,
      immutable: true
    },
    version: {
      type: String,
      immutable: true
    }
  },
  
  // Cryptographic integrity protection
  entryHash: {
    type: String,
    required: true,
    immutable: true,
    index: true
  },
  
  // Previous log entry hash for chain verification
  previousEntryHash: {
    type: String,
    immutable: true
  },
  
  // Information about the integrity mechanism
  integrity: {
    version: {
      type: String,
      immutable: true
    },
    algorithm: {
      type: String,
      immutable: true
    },
    chainType: {
      type: String,
      immutable: true
    }
  }
}, {
  ...baseSchema.baseOptions,
  // Disable any update operations by default
  strict: true,
  // Never allow update operations
  collection: 'hipaa_audit_logs'
});

// Prevent any updates
auditLogSchema.pre('updateOne', function(next) {
  const err = new Error('Audit logs cannot be modified');
  err.name = 'ImmutableError';
  next(err);
});

auditLogSchema.pre('findOneAndUpdate', function(next) {
  const err = new Error('Audit logs cannot be modified');
  err.name = 'ImmutableError';
  next(err);
});

auditLogSchema.pre('deleteOne', function(next) {
  const err = new Error('Audit logs cannot be deleted');
  err.name = 'ImmutableError';
  next(err);
});

auditLogSchema.pre('deleteMany', function(next) {
  const err = new Error('Audit logs cannot be deleted');
  err.name = 'ImmutableError';
  next(err);
});

// Add index for efficient querying
auditLogSchema.index({ timestamp: 1, 'actor.userId': 1 });
auditLogSchema.index({ timestamp: 1, 'resource.type': 1, 'resource.id': 1 });
auditLogSchema.index({ action: 1, timestamp: 1 });

// Export the model
const AuditLogModel = mongoose.model('HipaaAuditLog', auditLogSchema);

module.exports = { AuditLogModel };
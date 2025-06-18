// src/models/auditLog.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Audit Log Schema
 * Tracks all record access and modifications for compliance reporting
 */
const auditLogSchema = new Schema({
  // User who performed the action
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // User information for quick reference without joins
  userDetails: {
    name: String,
    email: String,
    role: String
  },
  
  // Entity type (Patient, MedicalRecord, Prescription, etc.)
  entityType: {
    type: String,
    required: true,
    index: true
  },
  
  // ID of the entity that was accessed/modified
  entityId: {
    type: Schema.Types.ObjectId,
    required: true,
    index: true
  },
  
  // Optional reference to a patient if the entity relates to a patient
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    index: true
  },
  
  // Action performed (view, create, update, delete)
  action: {
    type: String,
    enum: ['view', 'create', 'update', 'delete'],
    required: true,
    index: true
  },
  
  // Description of the action
  description: {
    type: String,
    required: true
  },
  
  // IP address of the user
  ipAddress: {
    type: String
  },
  
  // User agent (browser/app info)
  userAgent: {
    type: String
  },
  
  // For update operations, store the changed fields
  changes: {
    type: Schema.Types.Mixed
  },
  
  // Success/failure of the operation
  successful: {
    type: Boolean,
    required: true,
    default: true,
    index: true
  },
  
  // If the operation failed, reason for failure
  failureReason: {
    type: String
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt fields
});

// Add compound indexes for common queries
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ patientId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
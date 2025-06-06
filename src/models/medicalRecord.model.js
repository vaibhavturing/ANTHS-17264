// src/models/medicalRecord.model.js

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

// Define enum values for record categories
const RECORD_CATEGORIES = {
  LAB_RESULT: 'lab_result',
  IMAGING: 'imaging',
  PRESCRIPTION: 'prescription',
  VISIT_NOTE: 'visit_note',
  SURGICAL_REPORT: 'surgical_report',
  VACCINATION: 'vaccination',
  ALLERGY_REPORT: 'allergy_report',
  OTHER: 'other'
};

// Define schema for file attachments
const fileAttachmentSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { _id: true });

// Define access control schema
const accessControlSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accessLevel: {
    type: String,
    enum: ['read', 'write', 'admin'],
    default: 'read'
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  reason: {
    type: String,
    trim: true
  }
}, { _id: true });

// Define audit log entry schema
const auditLogEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['create', 'view', 'update', 'delete', 'share', 'print', 'download'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  details: {
    type: String
  }
}, { _id: true });

// Main medical record schema
const medicalRecordSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: Object.values(RECORD_CATEGORIES),
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  recordDate: {
    type: Date,
    required: true,
    index: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  facility: {
    type: String,
    trim: true
  },
  isConfidential: {
    type: Boolean,
    default: false
  },
  attachments: [fileAttachmentSchema],
  content: {
    type: Object,
    // Stores structured data specific to the record category
  },
  accessControls: [accessControlSchema],
  auditLog: [auditLogEntrySchema],
  tags: [{
    type: String,
    trim: true
  }],
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String
  },
  externalReferences: [{
    system: {
      type: String,
      required: true
    },
    identifier: {
      type: String,
      required: true
    },
    url: {
      type: String
    }
  }]
}, baseSchema.baseOptions);

// Add compound text index for search capabilities
medicalRecordSchema.index(
  { title: 'text', description: 'text', 'tags': 'text' },
  { name: 'medical_record_text_index', weights: { title: 10, tags: 5, description: 3 } }
);

// Add query helper methods
medicalRecordSchema.query.byPatient = function(patientId) {
  return this.where({ patient: patientId });
};

medicalRecordSchema.query.byCategory = function(category) {
  return this.where({ category });
};

medicalRecordSchema.query.byDateRange = function(startDate, endDate) {
  return this.where({
    recordDate: {
      $gte: startDate,
      $lte: endDate
    }
  });
};

// Add instance methods
medicalRecordSchema.methods.addAuditLogEntry = function(entry) {
  this.auditLog.push(entry);
};

medicalRecordSchema.methods.grantAccess = function(userId, accessLevel, grantedByUserId, reason = null, expiresAt = null) {
  const existingAccessIndex = this.accessControls.findIndex(
    access => access.user.toString() === userId.toString()
  );

  if (existingAccessIndex >= 0) {
    // Update existing access
    this.accessControls[existingAccessIndex].accessLevel = accessLevel;
    this.accessControls[existingAccessIndex].grantedBy = grantedByUserId;
    this.accessControls[existingAccessIndex].grantedAt = Date.now();
    this.accessControls[existingAccessIndex].reason = reason;
    this.accessControls[existingAccessIndex].expiresAt = expiresAt;
  } else {
    // Add new access control entry
    this.accessControls.push({
      user: userId,
      accessLevel,
      grantedBy: grantedByUserId,
      reason,
      expiresAt
    });
  }
};

medicalRecordSchema.methods.revokeAccess = function(userId) {
  this.accessControls = this.accessControls.filter(
    access => access.user.toString() !== userId.toString()
  );
};

medicalRecordSchema.methods.hasAccess = function(userId, requiredLevel = 'read') {
  // Find the user's access control entry
  const accessControl = this.accessControls.find(
    access => access.user.toString() === userId.toString()
  );

  // If no explicit access control exists, return false
  if (!accessControl) return false;

  // If access has expired, return false
  if (accessControl.expiresAt && accessControl.expiresAt < new Date()) return false;

  // Check required access level
  const accessLevels = ['read', 'write', 'admin'];
  const userAccessLevelIndex = accessLevels.indexOf(accessControl.accessLevel);
  const requiredLevelIndex = accessLevels.indexOf(requiredLevel);

  // User has sufficient access if their level is equal or higher than required
  return userAccessLevelIndex >= requiredLevelIndex;
};

// Export the model and constants
const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);

module.exports = {
  MedicalRecord,
  RECORD_CATEGORIES,
  accessLevels: ['read', 'write', 'admin'],
  auditActions: ['create', 'view', 'update', 'delete', 'share', 'print', 'download']
};
// src/models/patientConsentLog.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Patient Consent Log Schema
 * Tracks all consent activities for auditing and compliance
 */
const patientConsentLogSchema = new Schema({
  // Patient who gave consent
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  
  // User who recorded the consent
  recordedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Chat room the consent applies to
  chatRoomId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
    index: true
  },
  
  // Type of consent action
  actionType: {
    type: String,
    enum: ['granted', 'revoked', 'updated', 'expired'],
    required: true
  },
  
  // Consent details
  consentDetails: {
    method: {
      type: String,
      enum: ['verbal', 'written', 'electronic', 'implied'],
      required: true
    },
    consentDate: {
      type: Date,
      required: true
    },
    expirationDate: Date,
    scope: {
      type: String,
      enum: ['internal_discussion', 'external_limited', 'external_full'],
      default: 'internal_discussion'
    },
    notes: String,
    consentDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicalFile'
    }
  },
  
  // External sharing details (if applicable)
  externalSharing: {
    allowedDomains: [String],
    allowedEmails: [String],
    purposeOfSharing: String,
    sharingLimitations: String
  },
  
  // Witness information (if applicable)
  witness: {
    name: String,
    role: String,
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
patientConsentLogSchema.index({ patientId: 1, createdAt: -1 });
patientConsentLogSchema.index({ chatRoomId: 1, actionType: 1, createdAt: -1 });
patientConsentLogSchema.index({ 'consentDetails.expirationDate': 1 }, { 
  expireAfterSeconds: 0,
  partialFilterExpression: {
    'consentDetails.expirationDate': { $exists: true }
  }
});

const PatientConsentLog = mongoose.model('PatientConsentLog', patientConsentLogSchema);
module.exports = PatientConsentLog;
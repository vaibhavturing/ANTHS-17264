const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

// CHANGE: New model for tracking patient profile version history
const patientProfileVersionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  changedBy: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: String,
    role: String
  },
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    action: {
      type: String,
      enum: ['add', 'modify', 'delete'],
      required: true
    }
  }],
  reason: String,
  // Store a snapshot of key fields for this version
  snapshot: {
    demographics: Object,
    contactInfo: Object,
    allergies: Array,
    medications: Array,
    medicalHistory: Array,
    familyMedicalHistory: Array,
    vitalSigns: Object,
    lifestyle: Object
  },
}, baseSchema.baseOptions);

// Create compound index for efficient version history retrieval
patientProfileVersionSchema.index({ patientId: 1, versionNumber: -1 });
patientProfileVersionSchema.index({ patientId: 1, timestamp: -1 });
patientProfileVersionSchema.index({ 'changedBy.user': 1 });

// Virtual for generating change summary
patientProfileVersionSchema.virtual('changeSummary').get(function() {
  const fieldGroups = {};
  
  this.changes.forEach(change => {
    // Extract main category from field path (e.g., allergies.0.allergen -> allergies)
    const fieldBase = change.field.split('.')[0];
    
    if (!fieldGroups[fieldBase]) {
      fieldGroups[fieldBase] = [];
    }
    
    fieldGroups[fieldBase].push(change);
  });
  
  // Generate human-readable summary
  const summaries = [];
  for (const [group, changes] of Object.entries(fieldGroups)) {
    const actionCounts = {
      add: changes.filter(c => c.action === 'add').length,
      modify: changes.filter(c => c.action === 'modify').length,
      delete: changes.filter(c => c.action === 'delete').length
    };
    
    let summary = '';
    
    if (actionCounts.add > 0) {
      summary += `Added ${actionCounts.add} ${group} item(s). `;
    }
    
    if (actionCounts.modify > 0) {
      summary += `Modified ${actionCounts.modify} ${group} item(s). `;
    }
    
    if (actionCounts.delete > 0) {
      summary += `Removed ${actionCounts.delete} ${group} item(s).`;
    }
    
    if (summary) {
      summaries.push(summary.trim());
    }
  }
  
  return summaries;
});

const PatientProfileVersion = mongoose.model('PatientProfileVersion', patientProfileVersionSchema);

module.exports = PatientProfileVersion;
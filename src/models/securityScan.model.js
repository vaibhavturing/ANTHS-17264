/**
 * Security Scan Model
 * File: src/models/securityScan.model.js
 * 
 * Stores information about security scans performed on the application
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const securityScanSchema = new Schema({
  scanType: {
    type: String,
    required: true,
    enum: ['automated', 'manual', 'penetration_test', 'code_review', 'dependency_check']
  },
  scanDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  scannerName: {
    type: String,
    required: true
  },
  scannerVersion: {
    type: String
  },
  summary: {
    type: String
  },
  vulnerabilityCount: {
    type: Number,
    default: 0
  },
  vulnerabilitiesByLevel: {
    critical: {
      type: Number,
      default: 0
    },
    high: {
      type: Number,
      default: 0
    },
    medium: {
      type: Number,
      default: 0
    },
    low: {
      type: Number,
      default: 0
    },
    info: {
      type: Number,
      default: 0
    }
  },
  scanConfigOptions: {
    type: mongoose.Schema.Types.Mixed
  },
  scanDuration: {
    type: Number // in seconds
  },
  scanResults: {
    type: mongoose.Schema.Types.Mixed
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
securityScanSchema.index({ scanDate: -1 });
securityScanSchema.index({ scanType: 1, scanDate: -1 });
securityScanSchema.index({ 'vulnerabilitiesByLevel.critical': -1 });

module.exports = mongoose.model('SecurityScan', securityScanSchema);
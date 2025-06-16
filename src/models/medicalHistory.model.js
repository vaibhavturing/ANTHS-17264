const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const crypto = require('crypto');

// Encryption/decryption utility functions
function encryptField(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(config.ENCRYPTION_KEY, 'hex'), 
      iv
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

function decryptField(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  try {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(config.ENCRYPTION_KEY, 'hex'), 
      iv
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedText;
  }
}

// Schema for medical history entries
const medicalHistorySchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  condition: {
    type: String,
    required: true,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  diagnosisDate: {
    type: Date,
    required: true
  },
  diagnosedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'chronic', 'in_treatment'],
    default: 'active'
  },
  notes: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  treatmentPlan: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  relatedDocuments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  relatedLabResults: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabResult'
  }]
}, {
  ...baseSchema.baseOptions,
  toJSON: { getters: true },
  toObject: { getters: true }
});

const MedicalHistory = mongoose.model('MedicalHistory', medicalHistorySchema);

module.exports = MedicalHistory;
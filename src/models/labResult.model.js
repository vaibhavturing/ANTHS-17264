const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const crypto = require('crypto');

// Encryption/decryption utility functions (same as in other models)
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

// Schema for lab results
const labResultSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visitNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VisitNote'
  },
  relatedDiagnosis: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalHistory'
  },
  testName: {
    type: String,
    required: true
  },
  testCode: {
    type: String,
    required: true
  },
  orderDate: {
    type: Date,
    required: true
  },
  collectionDate: {
    type: Date
  },
  resultDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['ordered', 'collected', 'in_process', 'completed', 'cancelled'],
    default: 'ordered'
  },
  results: [{
    name: {
      type: String,
      required: true
    },
    value: {
      type: String,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
    },
    unit: String,
    referenceRange: String,
    flag: {
      type: String,
      enum: ['normal', 'low', 'high', 'critical_low', 'critical_high', 'abnormal'],
      default: 'normal'
    },
    notes: {
      type: String,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
    }
  }],
  labFacility: {
    name: String,
    address: String,
    phone: String
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
  attachments: [{
    fileName: String,
    fileType: String,
    fileSize: Number,
    filePath: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  ...baseSchema.baseOptions,
  toJSON: { getters: true },
  toObject: { getters: true }
});

const LabResult = mongoose.model('LabResult', labResultSchema);

module.exports = LabResult;
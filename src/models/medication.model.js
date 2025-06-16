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

// Schema for patient medications
const medicationSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  dosage: {
    type: String,
    required: true,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  frequency: {
    type: String,
    required: true,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  prescribedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  purpose: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  instructions: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  sideEffects: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  status: {
    type: String,
    enum: ['active', 'discontinued', 'completed'],
    default: 'active'
  },
  relatedCondition: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalHistory'
  },
  pharmacy: {
    name: String,
    phone: String,
    address: String
  }
}, {
  ...baseSchema.baseOptions,
  toJSON: { getters: true },
  toObject: { getters: true }
});

const Medication = mongoose.model('Medication', medicationSchema);

module.exports = Medication;
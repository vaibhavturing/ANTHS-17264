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

// Schema for allergies
const allergySchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  allergen: {
    type: String,
    required: true,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  allergenType: {
    type: String,
    enum: ['medication', 'food', 'environmental', 'other'],
    required: true
  },
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe', 'life_threatening'],
    required: true
  },
  reaction: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
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
  diagnosedDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  ...baseSchema.baseOptions,
  toJSON: { getters: true },
  toObject: { getters: true }
});

const Allergy = mongoose.model('Allergy', allergySchema);

module.exports = Allergy;
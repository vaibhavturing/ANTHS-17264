// src/models/patient.model.js
const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

// Schema for patient basic information
const patientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  dateOfBirth: {
    type: Date,
    required: true,
    // Encrypt sensitive data
    set: function(dob) {
      return encryptField(dob.toString());
    },
    get: function(dob) {
      return decryptField(dob);
    }
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    required: true
  },
  contactPhone: {
    type: String,
    required: true,
    set: function(phone) {
      return encryptField(phone);
    },
    get: function(phone) {
      return decryptField(phone);
    }
  },
  emergencyContact: {
    name: {
      type: String,
      required: true
    },
    relationship: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true,
      set: function(phone) {
        return encryptField(phone);
      },
      get: function(phone) {
        return decryptField(phone);
      }
    }
  },
  address: {
    street: {
      type: String,
      required: true,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'USA'
    }
  },
  primaryPhysician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  insuranceInfo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientInsurance'
  }],
  // Tracking consent for data sharing and communications
  consents: [{
    type: { 
      type: String, 
      enum: ['data_sharing', 'research', 'marketing', 'telehealth'],
      required: true
    },
    given: {
      type: Boolean,
      default: false
    },
    date: {
      type: Date,
      default: Date.now
    },
    expirationDate: {
      type: Date
    },
    documentReference: {
      type: String
    }
  }]
}, {
  ...baseSchema.baseOptions,
  toJSON: { 
    getters: true,
    virtuals: true
  },
  toObject: { 
    getters: true,
    virtuals: true
  }
});

// Encryption/decryption utility functions using the app's encryption key
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
    return text; // Fallback in case of error
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
    return encryptedText; // Return original value in case of error
  }
}

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for age calculation
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const dob = new Date(decryptField(this.dateOfBirth));
  const ageDifMs = Date.now() - dob.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
});

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
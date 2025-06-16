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

// Schema for visit notes
const visitNoteSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  visitDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  visitType: {
    type: String,
    enum: ['routine', 'follow_up', 'urgent', 'emergency', 'telemedicine'],
    required: true
  },
  chiefComplaint: {
    type: String,
    required: true,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  history: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  vitalSigns: {
    temperature: Number,
    heartRate: Number,
    bloodPressureSystolic: Number,
    bloodPressureDiastolic: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number,
    weight: Number,
    height: Number
  },
  assessment: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  plan: {
    type: String,
    set: function(val) {
      return encryptField(val);
    },
    get: function(val) {
      return decryptField(val);
    }
  },
  diagnoses: [{
    code: String,
    description: {
      type: String,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
    },
    type: {
      type: String,
      enum: ['primary', 'secondary']
    }
  }],
  prescriptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication'
  }],
  labOrders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabResult'
  }],
  followUpInstructions: {
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
    enum: ['draft', 'completed', 'signed', 'amended'],
    default: 'draft'
  },
  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  signedDate: {
    type: Date
  }
}, {
  ...baseSchema.baseOptions,
  toJSON: { getters: true },
  toObject: { getters: true }
});

const VisitNote = mongoose.model('VisitNote', visitNoteSchema);

module.exports = VisitNote;
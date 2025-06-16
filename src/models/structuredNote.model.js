const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const crypto = require('crypto');
const config = require('../config');

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

// Schema for structured notes (completed note forms)
const structuredNoteSchema = new mongoose.Schema({
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
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NoteTemplate',
    required: true
  },
  templateType: {
    type: String,
    required: true,
    enum: ['SOAP', 'Progress', 'Consultation', 'Discharge', 'Procedure', 'Physical', 'Mental', 'Custom']
  },
  title: {
    type: String,
    required: true
  },
  noteDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  content: {
    type: Map,
    of: {
      type: String,
      // Encrypt sensitive data when setting
      set: function(text) {
        return encryptField(text);
      },
      // Decrypt when getting
      get: function(text) {
        return decryptField(text);
      }
    }
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'signed', 'amended'],
    default: 'draft'
  },
  components: {
    chiefComplaint: {
      type: String,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
    },
    subjectiveData: {
      type: String,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
    },
    objectiveData: {
      type: String,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
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
  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  signedDate: {
    type: Date
  },
  amendments: [{
    date: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      required: true,
      set: function(val) {
        return encryptField(val);
      },
      get: function(val) {
        return decryptField(val);
      }
    },
    amendedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    previousContent: {
      type: Map,
      of: String
    }
  }],
  relatedNotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StructuredNote'
  }]
}, {
  ...baseSchema.baseOptions,
  toJSON: { getters: true, virtuals: true },
  toObject: { getters: true, virtuals: true }
});

// Add indexes for common queries
structuredNoteSchema.index({ patient: 1, noteDate: -1 });
structuredNoteSchema.index({ provider: 1, noteDate: -1 });
structuredNoteSchema.index({ templateType: 1 });
structuredNoteSchema.index({ status: 1 });

// Virtual field for formatted note date
structuredNoteSchema.virtual('formattedNoteDate').get(function() {
  return this.noteDate ? this.noteDate.toLocaleDateString() : null;
});

// Method to sign the note
structuredNoteSchema.methods.sign = async function(userId) {
  if (this.status === 'signed') {
    throw new Error('Note has already been signed');
  }
  
  this.signedBy = userId;
  this.signedDate = new Date();
  this.status = 'signed';
  await this.save();
  return this;
};

// Method to amend a signed note
structuredNoteSchema.methods.amend = async function(userId, reason, newContent) {
  if (this.status !== 'signed') {
    throw new Error('Only signed notes can be amended');
  }
  
  // Store previous content
  const previousContent = this.content;
  
  // Create amendment record
  this.amendments.push({
    date: new Date(),
    reason,
    amendedBy: userId,
    previousContent
  });
  
  // Update content
  this.content = newContent;
  this.status = 'amended';
  
  await this.save();
  return this;
};

const StructuredNote = mongoose.model('StructuredNote', structuredNoteSchema);

module.exports = StructuredNote;
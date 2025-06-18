// src/models/chatRoom.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');
const { encryptData, decryptData } = require('../utils/encryption');

/**
 * Chat Room Schema
 * Represents a secure discussion between healthcare providers about a specific case
 */
const chatRoomSchema = new Schema({
  // Chat room name (encrypted)
  name: {
    type: String,
    required: true,
    set: function(name) {
      // Store encrypted name
      this._name = name;
      return encryptData(name);
    },
    get: function(name) {
      // Return decrypted name
      return decryptData(name);
    }
  },
  
  // Description of the case being discussed (encrypted)
  description: {
    type: String,
    set: function(desc) {
      if (!desc) return null;
      this._description = desc;
      return encryptData(desc);
    },
    get: function(desc) {
      if (!desc) return null;
      return decryptData(desc);
    }
  },
  
  // Type of chat room
  type: {
    type: String,
    enum: ['case_discussion', 'general', 'department'],
    default: 'case_discussion',
    index: true
  },
  
  // Creator of the chat room
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Patient related to the case discussion (if applicable)
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    index: true
  },
  
  // Participants in the chat room
  participants: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Indicates if patient consent has been obtained for discussion
  patientConsent: {
    obtained: {
      type: Boolean,
      default: false
    },
    consentDate: Date,
    obtainedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    expirationDate: Date,
    notes: String,
    consentDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicalFile'
    }
  },
  
  // External sharing settings
  externalSharing: {
    allowed: {
      type: Boolean,
      default: false
    },
    requiresAdditionalConsent: {
      type: Boolean,
      default: true
    },
    allowedDomains: [String], // e.g., hospital.org
    allowedEmails: [String]
  },
  
  // Encryption details
  encryption: {
    algorithm: {
      type: String,
      default: 'aes-256-gcm'
    },
    keyId: {
      type: String,
      required: true
    },
    // Store a unique IV for this chat room
    iv: {
      type: String,
      default: () => crypto.randomBytes(16).toString('hex')
    }
  },
  
  // Whether the chat room is archived
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Whether the chat room is locked (no new messages allowed)
  isLocked: {
    type: Boolean,
    default: false
  },
  
  // Auto-expire settings (for temporary discussions)
  autoExpire: {
    enabled: {
      type: Boolean,
      default: false
    },
    date: Date
  }
}, {
  timestamps: true
});

// Add index for search
chatRoomSchema.index({
  createdAt: -1
});

// Add compound index for finding patient case discussions efficiently
chatRoomSchema.index({
  patientId: 1,
  isArchived: 1,
  createdAt: -1
});

// Virtual getter for original name
chatRoomSchema.virtual('plainName').get(function() {
  return this._name;
});

// Virtual getter for original description
chatRoomSchema.virtual('plainDescription').get(function() {
  return this._description;
});

// Method to check if a user is a participant
chatRoomSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.userId.toString() === userId.toString());
};

// Method to check if a user is the owner
chatRoomSchema.methods.isOwner = function(userId) {
  return this.participants.some(p => 
    p.userId.toString() === userId.toString() && p.role === 'owner'
  );
};

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
module.exports = ChatRoom;
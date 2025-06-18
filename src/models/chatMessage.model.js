// src/models/chatMessage.model.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { encryptData, decryptData } = require('../utils/encryption');

/**
 * Chat Message Schema
 * Represents an encrypted message in a chat room
 */
const chatMessageSchema = new Schema({
  // Chat room this message belongs to
  chatRoomId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatRoom',
    required: true,
    index: true
  },
  
  // Sender of the message
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Message content (encrypted)
  content: {
    type: String,
    required: true,
    set: function(content) {
      // Store the original content for immediate use
      this._content = content;
      // Encrypt for storage
      return encryptData(content);
    },
    get: function(content) {
      // Decrypt when accessing
      return decryptData(content);
    }
  },
  
  // Message type
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system', 'record_reference'],
    default: 'text'
  },
  
  // Referenced records (if this is a record reference message)
  recordReferences: [{
    recordType: {
      type: String,
      enum: ['medical_record', 'prescription', 'lab_result', 'imaging', 'note', 'document']
    },
    recordId: {
      type: Schema.Types.ObjectId
    },
    description: String
  }],
  
  // File attachments
  attachments: [{
    fileId: {
      type: Schema.Types.ObjectId,
      ref: 'MedicalFile'
    },
    fileName: String,
    fileType: String,
    fileSize: Number,
    thumbnailUrl: String
  }],
  
  // Read receipts
  readBy: [{
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Parent message (for replies/threads)
  parentMessageId: {
    type: Schema.Types.ObjectId,
    ref: 'ChatMessage',
    index: true
  },
  
  // If message was edited
  isEdited: {
    type: Boolean,
    default: false
  },
  
  // Edit history
  editHistory: [{
    content: String, // Encrypted content
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // If message is deleted
  isDeleted: {
    type: Boolean,
    default: false
  },
  
  // Message status (for system reliability)
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'failed'],
    default: 'sent'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
chatMessageSchema.index({ chatRoomId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1, createdAt: -1 });

// Virtual getter for original content
chatMessageSchema.virtual('plainContent').get(function() {
  return this._content;
});

// Pre-save middleware to handle message editing
chatMessageSchema.pre('save', function(next) {
  // If the message is being edited, save the previous content to history
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    // Push the old encrypted content to edit history
    this.editHistory.push({
      content: this.content,
      editedAt: new Date()
    });
  }
  next();
});

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
module.exports = ChatMessage;
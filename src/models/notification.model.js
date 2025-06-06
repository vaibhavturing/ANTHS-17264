// src/models/notification.model.js

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const { COMMUNICATION_TYPES } = require('./communication.model');

// Schema for in-app notifications
const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: Object.values(COMMUNICATION_TYPES),
    default: COMMUNICATION_TYPES.GENERAL
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,
  actionLink: String,
  relatedTo: {
    model: {
      type: String,
      enum: ['Appointment', 'MedicalRecord', 'Prescription', 'Communication']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedTo.model'
    }
  },
  icon: {
    type: String,
    default: 'notification'
  },
  expiresAt: Date
}, baseSchema.baseOptions);

// Add method to mark notification as read
notificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to get unread notifications count for a user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ 
    recipient: userId,
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

// Static method to get latest notifications for a user
notificationSchema.statics.getLatestNotifications = function(userId, limit = 10, includeRead = false) {
  let query = { 
    recipient: userId,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  };
  
  if (!includeRead) {
    query.isRead = false;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Create the notification model
const Notification = mongoose.model('Notification', notificationSchema);

module.exports = {
  Notification
};
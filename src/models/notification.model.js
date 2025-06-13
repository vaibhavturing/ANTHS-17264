const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

/**
 * Notification Schema
 * For system notifications like appointment reminders, doctor leave notifications, etc.
 */
const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'appointment_reminder',
      'appointment_update',
      'doctor_leave',
      'medical_record_update',
      'test_result',
      'prescription_renewal',
      'general'
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  recipients: {
    roles: [{
      type: String,
      enum: ['admin', 'doctor', 'nurse', 'patient', 'receptionist']
    }],
    userIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  read: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  actions: [{
    name: {
      type: String,
      required: true
    },
    link: {
      type: String,
      required: true
    }
  }]
}, baseSchema.baseOptions);

// Virtual for isRead
notificationSchema.virtual('isRead').get(function(userId) {
  return this.read ? this.read.includes(userId) : false;
});

// Virtual for unread count
notificationSchema.statics.getUnreadCount = async function(userId, userRoles = []) {
  const query = {
    read: { $ne: userId },
    $or: [
      { 'recipients.userIds': userId },
      { 'recipients.roles': { $in: userRoles } }
    ]
  };
  
  return this.countDocuments(query);
};

// Ensure the model includes virtual properties when converted to JSON
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = { Notification };
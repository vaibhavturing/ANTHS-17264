// src/models/communication.model.js

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

// Enum values for communication types
const COMMUNICATION_TYPES = {
  APPOINTMENT_REMINDER: 'appointment_reminder',
  TEST_RESULT: 'test_result',
  PRESCRIPTION_REFILL: 'prescription_refill',
  HEALTH_TIP: 'health_tip',
  EMERGENCY: 'emergency',
  GENERAL: 'general'
};

// Enum values for communication channels
const COMMUNICATION_CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  IN_APP: 'in_app',
  PUSH: 'push'
};

// Enum values for delivery status
const DELIVERY_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled'
};

// Define schema for delivery tracking
const deliveryTrackingSchema = new mongoose.Schema({
  channel: {
    type: String,
    enum: Object.values(COMMUNICATION_CHANNELS),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(DELIVERY_STATUS),
    default: DELIVERY_STATUS.PENDING
  },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  failureReason: String,
  retryCount: {
    type: Number,
    default: 0
  },
  externalId: String // ID from external service (email ID, SMS ID, etc.)
}, { _id: true });

// Main communication message schema
const communicationSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: Object.values(COMMUNICATION_TYPES),
    required: true,
    index: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  channels: [{
    type: String,
    enum: Object.values(COMMUNICATION_CHANNELS)
  }],
  deliveryTracking: [deliveryTrackingSchema],
  scheduledFor: {
    type: Date,
    index: true
  },
  expiresAt: Date,
  relatedTo: {
    model: {
      type: String,
      enum: ['Appointment', 'MedicalRecord', 'Prescription']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedTo.model'
    }
  },
  metadata: {
    type: Object,
    default: {}
  },
  isTemplate: {
    type: Boolean,
    default: false
  },
  templateVariables: [String]
}, baseSchema.baseOptions);

// Add indexes for efficient queries
communicationSchema.index({ 'deliveryTracking.status': 1, 'scheduledFor': 1 });
communicationSchema.index({ 'patient': 1, 'type': 1, 'createdAt': -1 });

// Define model for patient communication preferences
const communicationPreferenceSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    unique: true
  },
  // Default channel preferences by notification type
  channelPreferences: {
    appointment_reminder: {
      channels: [{
        type: String,
        enum: Object.values(COMMUNICATION_CHANNELS)
      }],
      enabled: {
        type: Boolean,
        default: true
      },
      advanceNotice: {
        type: Number, // Hours in advance to send reminder
        default: 24
      }
    },
    test_result: {
      channels: [{
        type: String,
        enum: Object.values(COMMUNICATION_CHANNELS)
      }],
      enabled: {
        type: Boolean,
        default: true
      }
    },
    prescription_refill: {
      channels: [{
        type: String,
        enum: Object.values(COMMUNICATION_CHANNELS)
      }],
      enabled: {
        type: Boolean,
        default: true
      },
      refillReminder: {
        type: Number, // Days before prescription runs out
        default: 5
      }
    },
    health_tip: {
      channels: [{
        type: String,
        enum: Object.values(COMMUNICATION_CHANNELS)
      }],
      enabled: {
        type: Boolean,
        default: true
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly'],
        default: 'weekly'
      }
    },
    emergency: {
      channels: [{
        type: String,
        enum: Object.values(COMMUNICATION_CHANNELS)
      }],
      enabled: {
        type: Boolean,
        default: true
      }
    },
    general: {
      channels: [{
        type: String,
        enum: Object.values(COMMUNICATION_CHANNELS)
      }],
      enabled: {
        type: Boolean,
        default: true
      }
    }
  },
  // Do-not-disturb time periods
  doNotDisturb: {
    enabled: {
      type: Boolean,
      default: false
    },
    startTime: {
      type: String, // Format: 'HH:MM' in 24-hour format
      default: '22:00'
    },
    endTime: {
      type: String, // Format: 'HH:MM' in 24-hour format
      default: '07:00'
    },
    overrideForEmergencies: {
      type: Boolean,
      default: true
    }
  },
  contactInfo: {
    email: {
      address: String,
      verified: {
        type: Boolean,
        default: false
      }
    },
    phone: {
      number: String,
      verified: {
        type: Boolean,
        default: false
      }
    }
  },
  // Opt-out status
  optOut: {
    allCommunications: {
      type: Boolean,
      default: false
    },
    marketing: {
      type: Boolean,
      default: false
    }
  }
}, baseSchema.baseOptions);

// Add a method to check if a patient can receive a specific notification type
communicationPreferenceSchema.methods.canReceiveNotification = function(type, channel) {
  // Check global opt-out first
  if (this.optOut.allCommunications) return false;
  
  // Check if marketing and type is health tip
  if (this.optOut.marketing && type === COMMUNICATION_TYPES.HEALTH_TIP) return false;
  
  // Check if notification type is enabled
  if (!this.channelPreferences[type]?.enabled) return false;
  
  // Check if channel is in preferred channels for this type
  if (channel && !this.channelPreferences[type]?.channels.includes(channel)) return false;
  
  return true;
};

// Check if current time is within Do Not Disturb period
communicationPreferenceSchema.methods.isInDoNotDisturbPeriod = function(messageType) {
  if (!this.doNotDisturb.enabled) return false;
  
  // Allow emergency notifications regardless of DND if override is set
  if (messageType === COMMUNICATION_TYPES.EMERGENCY && this.doNotDisturb.overrideForEmergencies) {
    return false;
  }
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  
  // Parse DND times
  const [startHour, startMinute] = this.doNotDisturb.startTime.split(':').map(Number);
  const [endHour, endMinute] = this.doNotDisturb.endTime.split(':').map(Number);
  
  const startTimeMinutes = startHour * 60 + startMinute;
  const endTimeMinutes = endHour * 60 + endMinute;
  
  // Handle case where DND period crosses midnight
  if (startTimeMinutes > endTimeMinutes) {
    return currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
  } else {
    return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
  }
};

// Export models and constants
const Communication = mongoose.model('Communication', communicationSchema);
const CommunicationPreference = mongoose.model('CommunicationPreference', communicationPreferenceSchema);

module.exports = {
  Communication,
  CommunicationPreference,
  COMMUNICATION_TYPES,
  COMMUNICATION_CHANNELS,
  DELIVERY_STATUS
};
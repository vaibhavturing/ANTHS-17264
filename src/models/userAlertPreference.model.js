const mongoose = require('mongoose');
const { Schema } = mongoose;

const alertPreferenceSchema = new Schema({
  // Reference to the alert
  alert: {
    type: Schema.Types.ObjectId,
    ref: 'ClinicalAlert',
    required: true
  },
  // User's preference for this alert
  status: {
    type: String,
    enum: ['enabled', 'muted', 'disabled'],
    default: 'enabled'
  },
  // If the user customized the severity
  customSeverity: {
    type: String,
    enum: ['info', 'warning', 'critical']
  },
  // If the user customized the text
  customText: {
    title: String,
    description: String
  },
  // Reminder date if alert is temporarily muted
  muteUntil: {
    type: Date
  },
  // Reason for muting/disabling
  reasonForMuting: {
    type: String
  }
});

const categoryPreferenceSchema = new Schema({
  // Category of alerts
  category: {
    type: String,
    enum: [
      'drug-interaction', 
      'preventive-care', 
      'diagnosis-alert', 
      'lab-alert', 
      'best-practice',
      'administrative'
    ],
    required: true
  },
  // User's preference for this category
  status: {
    type: String,
    enum: ['enabled', 'muted', 'disabled'],
    default: 'enabled'
  },
  // Reason for muting/disabling category
  reasonForMuting: {
    type: String
  }
});

const userAlertPreferenceSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Global alert setting
    globalAlertStatus: {
      type: String,
      enum: ['enabled', 'critical-only', 'disabled'],
      default: 'enabled'
    },
    // Category-level preferences
    categoryPreferences: [categoryPreferenceSchema],
    // Individual alert preferences
    alertPreferences: [alertPreferenceSchema]
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Compound index for efficient lookups
userAlertPreferenceSchema.index({ user: 1, 'alertPreferences.alert': 1 });
userAlertPreferenceSchema.index({ user: 1, 'categoryPreferences.category': 1 });

const UserAlertPreference = mongoose.model('UserAlertPreference', userAlertPreferenceSchema);

module.exports = UserAlertPreference;
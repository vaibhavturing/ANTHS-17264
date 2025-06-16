const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

const doctorSettingsSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  cancellationRule: {
    type: String,
    enum: ['24h', '48h', '72h', 'custom', 'none'],
    default: '24h'
  },
  customCancellationHours: {
    type: Number,
    min: 1,
    max: 168, // 1 week in hours
    default: 24
  },
  autoFillFromWaitlist: {
    type: Boolean,
    default: true
  },
  bufferTimeBetweenAppointments: {
    type: Number, // in minutes
    default: 15,
    min: 0,
    max: 120
  },
  allowRescheduling: {
    type: Boolean,
    default: true
  },
  reschedulingTimeLimit: {
    type: Number, // hours before appointment that rescheduling is allowed
    default: 24
  },
  defaultAppointmentDuration: {
    type: Number, // in minutes
    default: 30
  },
  // Notifications preferences
  notifications: {
    appointmentBooked: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    appointmentCancelled: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    appointmentRescheduled: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    }
  }
}, baseSchema.baseOptions);

const DoctorSettings = mongoose.model('DoctorSettings', doctorSettingsSchema);

module.exports = DoctorSettings;
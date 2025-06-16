const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

const waitlistSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  appointmentType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType',
    required: true
  },
  requestedDate: {
    type: Date,
    required: true
  },
  // Flexible date range the patient is available for
  dateRangeStart: {
    type: Date,
    required: true
  },
  dateRangeEnd: {
    type: Date,
    required: true
  },
  // Time preferences
  preferredTimeOfDay: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'any'],
    default: 'any'
  },
  // Priority can be used to determine order when auto-filling slots
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  status: {
    type: String,
    enum: ['active', 'fulfilled', 'expired', 'cancelled'],
    default: 'active'
  },
  // Track notifications sent to patient
  notificationCount: {
    type: Number,
    default: 0
  },
  lastNotified: {
    type: Date
  },
  notes: {
    type: String,
    trim: true
  },
  // Auto-accept appointment if offered
  autoAccept: {
    type: Boolean,
    default: false
  },
  // If patient was offered an appointment but declined
  offeredAppointments: [{
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    offeredAt: Date,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending'
    }
  }]
}, baseSchema.baseOptions);

// Indexes for better query performance
waitlistSchema.index({ doctor: 1, status: 1, priority: -1 });
waitlistSchema.index({ patient: 1, status: 1 });
waitlistSchema.index({ dateRangeStart: 1, dateRangeEnd: 1, status: 1 });

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

module.exports = Waitlist;
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
  // NEW FIELDS FOR SLOT HOLDING
  // Currently held slot information
  heldSlot: {
    slotId: String,
    doctorId: mongoose.Schema.Types.ObjectId,
    startTime: Date,
    endTime: Date,
    heldUntil: Date, // Time until the slot is held
    appointmentTypeId: mongoose.Schema.Types.ObjectId
  },
  // Communication preferences
  contactPreferences: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: true
    },
    preferredMethod: {
      type: String,
      enum: ['email', 'sms', 'both'],
      default: 'both'
    }
  },
  // Phone number for SMS notifications - could also be fetched from patient profile
  phoneNumber: {
    type: String,
    validate: {
      validator: function(v) {
        return /^\+?[0-9]{10,15}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  // Track all offered slots and their status
  offeredAppointments: [{
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    doctorId: mongoose.Schema.Types.ObjectId,
    startTime: Date,
    endTime: Date,
    offeredAt: Date,
    respondBy: Date, // Deadline to respond
    notificationSent: {
      email: {
        sent: Boolean,
        sentAt: Date,
        deliveryStatus: String
      },
      sms: {
        sent: Boolean,
        sentAt: Date,
        deliveryStatus: String
      }
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending'
    }
  }]
}, baseSchema.baseOptions);

// Indexes for better query performance
waitlistSchema.index({ doctor: 1, status: 1, priority: -1 });
waitlistSchema.index({ patient: 1, status: 1 });
waitlistSchema.index({ dateRangeStart: 1, dateRangeEnd: 1, status: 1 });
waitlistSchema.index({ 'heldSlot.heldUntil': 1 }, { expireAfterSeconds: 0 }); // For TTL index to automatically expire held slots

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

module.exports = Waitlist;
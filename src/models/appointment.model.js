const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

/**
 * Schema for appointments in the Healthcare Management Application
 */
const appointmentSchema = new mongoose.Schema({
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
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // Duration in minutes
    required: true,
    min: 5
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'checked-in', 'completed', 'cancelled', 'no-show', 'pending'],
    default: 'scheduled'
  },
  cancellationReason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  // New field: For telehealth appointments
  videoLink: {
    type: String,
    trim: true
  },
  // New field: Special instructions for the appointment
  specialInstructions: {
    type: String,
    trim: true
  },
  // New field: Flag to indicate if this is a recurring appointment
  isRecurring: {
    type: Boolean,
    default: false
  },
  // New field: Reference to recurring appointment series if applicable
  recurringSeriesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringAppointmentSeries'
  },
  // New field: Temporary lock for preventing double booking
  temporaryLock: {
    isLocked: {
      type: Boolean, 
      default: false
    },
    lockedUntil: {
      type: Date
    },
    lockId: {
      type: String
    }
  }
  // Note: temporaryLock is a new addition to prevent double booking
}, baseSchema.baseOptions);

// Index for efficient querying of appointments by doctor and time range
appointmentSchema.index({ doctor: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ patient: 1, startTime: 1 }); // For patient's upcoming appointments
appointmentSchema.index({ status: 1 }); // For querying by status

// Virtual for appointment duration in minutes
appointmentSchema.virtual('durationMinutes').get(function() {
  return this.duration;
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

/**
 * Schema for recurring appointment series
 */
const recurringAppointmentSeriesSchema = new mongoose.Schema({
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
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly'],
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  dayOfWeek: {
    type: Number, // 0 = Sunday, 1 = Monday, etc.
    min: 0,
    max: 6
  },
  timeOfDay: {
    type: String, // HH:MM format
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Time must be in HH:MM format'
    }
  },
  duration: {
    type: Number, // Duration in minutes
    required: true,
    min: 5
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  }
}, baseSchema.baseOptions);

const RecurringAppointmentSeries = mongoose.model('RecurringAppointmentSeries', recurringAppointmentSeriesSchema);

module.exports = {
  Appointment,
  RecurringAppointmentSeries
};
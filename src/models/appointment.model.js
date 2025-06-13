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
  // For telehealth appointments
  videoLink: {
    type: String,
    trim: true
  },
  // Special instructions for the appointment
  specialInstructions: {
    type: String,
    trim: true
  },
  // CHANGE: Enhanced fields for recurring appointments
  // Flag to indicate if this is part of a recurring series
  isPartOfSeries: {
    type: Boolean,
    default: false
  },
  // Reference to the recurring series this appointment belongs to
  recurringSeriesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringAppointmentSeries'
  },
  // Position in the series (e.g., 1st, 2nd, etc.)
  seriesPosition: {
    type: Number,
    min: 1
  },
  // Whether this specific occurrence has been modified from the original series pattern
  isModifiedOccurrence: {
    type: Boolean,
    default: false
  },
  // Temporary lock for preventing double booking
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
}, baseSchema.baseOptions);

// Index for efficient querying of appointments by doctor and time range
appointmentSchema.index({ doctor: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ patient: 1, startTime: 1 }); // For patient's upcoming appointments
appointmentSchema.index({ status: 1 }); // For querying by status
// CHANGE: Added index for recurring appointments
appointmentSchema.index({ recurringSeriesId: 1, seriesPosition: 1 });

// Virtual for appointment duration in minutes
appointmentSchema.virtual('durationMinutes').get(function() {
  return this.duration;
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = {
  Appointment
};
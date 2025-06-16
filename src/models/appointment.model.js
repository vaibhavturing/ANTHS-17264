const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

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
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  appointmentType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType',
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no-show'],
    default: 'scheduled'
  },
  notes: {
    type: String,
    trim: true
  },
  // Added cancellation rule
  cancellationRule: {
    type: String,
    enum: ['24h', '48h', '72h', 'custom', 'none'],
    default: '24h'
  },
  // Added custom cancellation hours for custom rule
  customCancellationHours: {
    type: Number,
    min: 1,
    max: 168, // 1 week in hours
    default: 24
  },
  // Fields to track rescheduling history
  previousStartTime: Date,
  previousEndTime: Date,
  rescheduleReason: String,
  rescheduleDate: Date,
  // Field to track if this appointment was filled from waitlist
  filledFromWaitlist: {
    type: Boolean,
    default: false
  }
}, baseSchema.baseOptions);

// Add indexes for better query performance
appointmentSchema.index({ doctor: 1, startTime: 1, endTime: 1 });
appointmentSchema.index({ patient: 1, startTime: 1 });
appointmentSchema.index({ status: 1, startTime: 1 });

// Method to check if appointment can be cancelled based on cancellation rules
appointmentSchema.methods.canCancel = function() {
  const now = new Date();
  const hoursBeforeAppointment = (this.startTime - now) / (1000 * 60 * 60);
  
  switch (this.cancellationRule) {
    case '24h':
      return hoursBeforeAppointment >= 24;
    case '48h':
      return hoursBeforeAppointment >= 48;
    case '72h':
      return hoursBeforeAppointment >= 72;
    case 'custom':
      return hoursBeforeAppointment >= this.customCancellationHours;
    case 'none':
      return true;
    default:
      return hoursBeforeAppointment >= 24;
  }
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
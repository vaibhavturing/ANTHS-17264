// src/models/appointment.model.js
const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
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
  status: {
    type: String,
    enum: ['scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },
  type: {
    type: String,
    enum: ['new_patient', 'follow_up', 'specialist', 'urgent', 'routine'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  checkinTime: {
    type: Date
  },
  completionTime: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  cancellationTime: {
    type: Date
  },
  cancelledBy: {
    type: String,
    enum: ['patient', 'doctor', 'staff']
  },
  notifyPatient: {
    type: Boolean,
    default: true
  },
  followUpRecommendation: {
    recommended: {
      type: Boolean,
      default: false
    },
    timeframe: {
      type: String,
      enum: ['1_week', '2_weeks', '1_month', '3_months', '6_months', '1_year']
    }
  },
  remindersSent: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push']
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'failed']
    }
  }],
  // For self-scheduling
  selfScheduled: {
    type: Boolean,
    default: false
  },
  // Tracking changes
  history: [{
    action: {
      type: String,
      enum: ['created', 'rescheduled', 'cancelled', 'checked_in', 'completed', 'no_show']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: String,
      enum: ['patient', 'doctor', 'staff', 'system']
    },
    previousValues: {
      startTime: Date,
      endTime: Date,
      doctor: mongoose.Schema.Types.ObjectId,
      status: String
    },
    notes: String
  }]
}, baseSchema.baseOptions);

// Indexes for efficient querying
appointmentSchema.index({ patient: 1, startTime: -1 });
appointmentSchema.index({ doctor: 1, startTime: -1 });
appointmentSchema.index({ status: 1, startTime: 1 });
appointmentSchema.index({ startTime: 1, endTime: 1 });

// Pre-save hook to add history entry
appointmentSchema.pre('save', function(next) {
  // Skip for new appointments
  if (this.isNew) {
    this.history.push({
      action: 'created',
      performedBy: this.selfScheduled ? 'patient' : 'staff',
    });
    return next();
  }
  
  // For existing appointments
  if (this.isModified('status') || 
      this.isModified('startTime') || 
      this.isModified('endTime') ||
      this.isModified('doctor')) {
    
    let action = 'rescheduled';
    if (this.isModified('status')) {
      if (this.status === 'cancelled') action = 'cancelled';
      else if (this.status === 'checked_in') action = 'checked_in';
      else if (this.status === 'completed') action = 'completed';
      else if (this.status === 'no_show') action = 'no_show';
    }
    
    const previousValues = {};
    if (this._previousModifiedPaths.includes('startTime')) previousValues.startTime = this._oldModifiedPaths.startTime;
    if (this._previousModifiedPaths.includes('endTime')) previousValues.endTime = this._oldModifiedPaths.endTime;
    if (this._previousModifiedPaths.includes('doctor')) previousValues.doctor = this._oldModifiedPaths.doctor;
    if (this._previousModifiedPaths.includes('status')) previousValues.status = this._oldModifiedPaths.status;
    
    this.history.push({
      action,
      // Ideally, this would be derived from the user making the change
      performedBy: 'staff',
      previousValues
    });
  }
  
  next();
});

// Method to check for conflicts with doctor's schedule
appointmentSchema.statics.checkDoctorAvailability = async function(doctorId, startTime, endTime, excludeAppointmentId = null) {
  const query = {
    doctor: doctorId,
    status: 'scheduled',
    $or: [
      { // New appointment starts during an existing appointment
        startTime: { $lte: startTime },
        endTime: { $gt: startTime }
      },
      { // New appointment ends during an existing appointment
        startTime: { $lt: endTime },
        endTime: { $gte: endTime }
      },
      { // New appointment encompasses an existing appointment
        startTime: { $gte: startTime },
        endTime: { $lte: endTime }
      }
    ]
  };
  
  // Exclude the current appointment if we're checking for reschedule conflicts
  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }
  
  const conflictingAppointments = await this.find(query).exec();
  return conflictingAppointments.length === 0;
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
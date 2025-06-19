// src/models/appointment.model.js
// Complete appointment model with optimized indexes for high concurrency
// OPTIMIZED: Added multiple indexes for high concurrency appointment queries

const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Appointment Schema
 */
const appointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true // OPTIMIZATION: Added index for patient lookups
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    index: true // OPTIMIZATION: Added index for doctor lookups
  },
  startTime: {
    type: Date,
    required: true,
    index: true // OPTIMIZATION: Added index for datetime queries
  },
  endTime: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['regular', 'urgent', 'follow-up', 'yearly-checkup', 'telehealth'],
    default: 'regular',
    index: true // OPTIMIZATION: Added index for filtering by type
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'pending',
    index: true // OPTIMIZATION: Added index for status filtering
  },
  auditTrail: [{
    action: {
      type: String,
      enum: ['created', 'updated', 'cancelled', 'completed', 'rescheduled', 'checked-in']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changes: {
      type: Object
    }
  }]
}, baseSchema.baseOptions);

// OPTIMIZATION: Added compound index for doctor scheduling
appointmentSchema.index({ doctorId: 1, startTime: 1 });

// OPTIMIZATION: Added compound index for patient appointment history
appointmentSchema.index({ patientId: 1, startTime: -1 });

// OPTIMIZATION: Added compound index for filtering appointments by status and date
appointmentSchema.index({ status: 1, startTime: 1 });

// Pre save hook to validate appointments
appointmentSchema.pre('save', async function(next) {
  try {
    // Only run validation on new appointments or when times are modified
    if (this.isNew || this.isModified('startTime') || this.isModified('endTime')) {
      // Ensure end time is after start time
      if (this.endTime <= this.startTime) {
        throw new Error('Appointment end time must be after start time');
      }
      
      // For new appointments, ensure they're not in the past
      if (this.isNew && this.startTime < new Date()) {
        throw new Error('Cannot create appointments in the past');
      }
      
      // If audit trail doesn't exist, initialize it
      if (!this.auditTrail || this.auditTrail.length === 0) {
        this.auditTrail = [{
          action: 'created',
          timestamp: new Date(),
          performedBy: this.createdBy || null
        }];
      }
    }
    
    next();
  } catch (error) {
    logger.error('Appointment validation error', { error: error.message });
    next(error);
  }
});

// Method to check if appointment is cancellable
appointmentSchema.methods.isCancellable = function() {
  // Cannot cancel already completed or cancelled appointments
  if (['completed', 'cancelled', 'no-show'].includes(this.status)) {
    return false;
  }
  
  // Allow cancellation only up to 24 hours before appointment
  const now = new Date();
  const appointmentTime = new Date(this.startTime);
  const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);
  
  return hoursUntilAppointment >= 24;
};

// Method to check if appointment is reschedulable
appointmentSchema.methods.isReschedulable = function() {
  // Same rules as cancellation
  return this.isCancellable();
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
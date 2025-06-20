// src/models/appointment.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const appointmentSchema = new Schema({
  patient: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    default: 30, // Default duration in minutes
    required: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  type: {
    type: String,
    enum: ['routine', 'follow-up', 'urgent', 'specialist', 'telemedicine'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  location: {
    type: String,
    required: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  cancelReason: {
    type: String
  },
  reminderSent: {
    type: Boolean,
    default: false
  }
});

// ADDED INDEXES FOR PERFORMANCE OPTIMIZATION
// Index for faster patient appointment lookups
appointmentSchema.index({ patient: 1, scheduledTime: -1 });

// Index for faster doctor schedule lookups
appointmentSchema.index({ doctor: 1, scheduledTime: -1 });

// Compound index for status-based queries
appointmentSchema.index({ status: 1, scheduledTime: 1 });

// Index for date range queries
appointmentSchema.index({ scheduledTime: 1 });

// Index for location-based queries
appointmentSchema.index({ location: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
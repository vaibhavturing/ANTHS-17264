const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

/**
 * Schema for appointment types in the Healthcare Management Application
 * Types include: "New Patient", "Follow-Up", "Telehealth", etc.
 * Each type has specific duration and requirements
 */
const appointmentTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Duration in minutes
  duration: {
    type: Number,
    required: true,
    min: 5,
    max: 180
  },
  // Buffer time in minutes (additional time after appointment)
  bufferTime: {
    type: Number,
    default: 0,
    min: 0,
    max: 60
  },
  // Special requirements for this appointment type
  requirements: [{
    type: String,
    trim: true
  }],
  // For telehealth appointments, indicates if video link is required
  requiresVideoLink: {
    type: Boolean,
    default: false
  },
  // Indicates if this type is for new patients
  isNewPatient: {
    type: Boolean,
    default: false
  },
  // CHANGE: Enhanced color field with documentation
  // Color for calendar visualization - used to color-code different appointment types
  color: {
    type: String,
    default: '#3498db', // Default blue color,
    validate: {
      validator: function(v) {
        return /^#[0-9a-fA-F]{6}$/.test(v);
      },
      message: 'Color must be a valid hex color code (e.g., #3498db)'
    }
  },
  // Whether this appointment type is active/available for booking
  isActive: {
    type: Boolean,
    default: true
  },
  // CHANGE: Added priority field for visual emphasis (emergencies, etc.)
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  // Specific doctors who offer this appointment type
  // If empty, available to all doctors
  availableDoctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, baseSchema.baseOptions);

// Virtual for total time including buffer
appointmentTypeSchema.virtual('totalTime').get(function() {
  return this.duration + this.bufferTime;
});

// Index for faster lookups
appointmentTypeSchema.index({ name: 1 });
appointmentTypeSchema.index({ isActive: 1 });

const AppointmentType = mongoose.model('AppointmentType', appointmentTypeSchema);

module.exports = AppointmentType;
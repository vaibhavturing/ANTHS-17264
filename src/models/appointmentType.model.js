// File: src/models/appointmentType.model.js
const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Appointment Type Schema
 * Defines different types of appointments with specific durations and buffer times
 */
const appointmentTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Duration in minutes
  duration: {
    type: Number,
    required: true,
    min: 5,
    default: 30
  },
  // Buffer time in minutes to add after this appointment type
  bufferTime: {
    type: Number,
    default: 0,
    min: 0
  },
  // Color code for UI representation
  color: {
    type: String,
    default: '#3498db'
  },
  // Additional preparation time needed before the appointment (in minutes)
  preparationTime: {
    type: Number,
    default: 0,
    min: 0
  },
  // Department or specialty this appointment type is available for
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  // Is this appointment type available for online scheduling by patients
  isOnlineBookable: {
    type: Boolean,
    default: true
  },
  // Special instructions or requirements for this appointment type
  specialRequirements: {
    type: String,
    trim: true
  },
  // Status of this appointment type
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Whether this appointment type requires specific equipment or resources
  requiredResources: [{
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource'
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    }
  }]
}, baseSchema.baseOptions);

// Ensure name is unique within a department
appointmentTypeSchema.index({ name: 1, department: 1 }, { unique: true });

// Middleware to log appointment type creation and updates
appointmentTypeSchema.pre('save', function(next) {
  if (this.isNew) {
    logger.info('Creating new appointment type', { name: this.name, duration: this.duration });
  } else if (this.isModified()) {
    logger.info('Updating appointment type', { id: this._id, name: this.name });
  }
  next();
});

// Method to get total time including preparation, appointment duration and buffer
appointmentTypeSchema.methods.getTotalTimeRequired = function() {
  return this.preparationTime + this.duration + this.bufferTime;
};

// Static method to find active appointment types for a department
appointmentTypeSchema.statics.findActiveByDepartment = async function(departmentId) {
  return this.find({
    department: departmentId,
    status: 'active'
  }).sort('name');
};

const AppointmentType = mongoose.model('AppointmentType', appointmentTypeSchema);

module.exports = AppointmentType;
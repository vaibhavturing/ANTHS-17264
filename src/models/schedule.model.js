// File: src/models/schedule.model.js
const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const moment = require('moment');
const logger = require('../utils/logger');

/**
 * Time Slot Schema
 * Represents an individual time slot in a doctor's schedule
 */
const timeSlotSchema = new mongoose.Schema({
  // Start time in ISO format
  startTime: {
    type: Date,
    required: true
  },
  // End time in ISO format
  endTime: {
    type: Date,
    required: true
  },
  // Status of this time slot
  status: {
    type: String,
    enum: ['available', 'booked', 'blocked', 'leave', 'break'],
    default: 'available'
  },
  // Appointment type this slot is configured for (if applicable)
  appointmentType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType'
  },
  // Reference to an appointment if this slot is booked
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  // Notes about this time slot (e.g., reason for blocking)
  notes: {
    type: String,
    trim: true
  },
  // Tags for categorizing time slots
  tags: [{
    type: String,
    trim: true
  }]
}, { _id: true });

// Method to check if time slot is available
timeSlotSchema.methods.isAvailable = function() {
  return this.status === 'available';
};

/**
 * Recurring Schedule Template Schema
 * Defines a repeating pattern for a doctor's schedule
 */
const recurringTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Doctor this template belongs to
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Weekly schedule definition (array of daily schedules)
  weeklySchedule: [{
    // Day of week (0-6, where 0 is Sunday)
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6
    },
    // Working hours for this day
    workingHours: [{
      // Start time in 24-hour format (HH:MM)
      startTime: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'Start time must be in 24-hour format (HH:MM)'
        }
      },
      // End time in 24-hour format (HH:MM)
      endTime: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'End time must be in 24-hour format (HH:MM)'
        }
      },
      // Appointment types available during this time period
      appointmentTypes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AppointmentType'
      }]
    }],
    // Breaks for this day
    breaks: [{
      // Start time in 24-hour format (HH:MM)
      startTime: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'Start time must be in 24-hour format (HH:MM)'
        }
      },
      // End time in 24-hour format (HH:MM)
      endTime: {
        type: String,
        required: true,
        validate: {
          validator: function(v) {
            return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
          },
          message: 'End time must be in 24-hour format (HH:MM)'
        }
      },
      // Reason for the break (e.g., 'Lunch', 'Administrative tasks')
      reason: {
        type: String,
        trim: true
      }
    }]
  }],
  // Status of this template
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Effective date range for this template
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveUntil: {
    type: Date,
    default: null
  },
  // Priority of this template (higher number = higher priority for conflict resolution)
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  // Recurrence rule (e.g., 'FREQ=WEEKLY;INTERVAL=1')
  recurrenceRule: {
    type: String,
    default: 'FREQ=WEEKLY;INTERVAL=1'
  }
}, baseSchema.baseOptions);

/**
 * Doctor Schedule Schema
 * Represents a doctor's schedule with time slots
 */
const doctorScheduleSchema = new mongoose.Schema({
  // Doctor this schedule belongs to
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Date of this schedule
  date: {
    type: Date,
    required: true
  },
  // Time slots for this schedule day
  timeSlots: [timeSlotSchema],
  // Template this schedule was generated from (if applicable)
  generatedFrom: {
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringTemplate'
    },
    generatedAt: {
      type: Date
    }
  },
  // Working day flag
  isWorkingDay: {
    type: Boolean,
    default: true
  },
  // Notes about this schedule day
  notes: {
    type: String,
    trim: true
  },
  // Status of this schedule day
  status: {
    type: String,
    enum: ['draft', 'published', 'modified'],
    default: 'draft'
  },
  // Last modified timestamp
  lastModified: {
    type: Date,
    default: Date.now
  },
  // User who last modified this schedule
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, baseSchema.baseOptions);

// Compound index for efficient querying
doctorScheduleSchema.index({ doctor: 1, date: 1 }, { unique: true });

// Pre-save middleware to validate time slots don't overlap
doctorScheduleSchema.pre('save', function(next) {
  // Sort time slots by start time
  this.timeSlots.sort((a, b) => a.startTime - b.startTime);
  
  // Check for overlapping time slots
  for (let i = 0; i < this.timeSlots.length - 1; i++) {
    if (this.timeSlots[i].endTime > this.timeSlots[i + 1].startTime) {
      const error = new Error('Time slots cannot overlap');
      logger.error('Detected overlapping time slots in doctor schedule', {
        doctorId: this.doctor,
        date: this.date,
        slot1: {
          start: this.timeSlots[i].startTime,
          end: this.timeSlots[i].endTime
        },
        slot2: {
          start: this.timeSlots[i + 1].startTime,
          end: this.timeSlots[i + 1].endTime
        }
      });
      return next(error);
    }
  }
  
  // Set lastModified timestamp
  this.lastModified = Date.now();
  
  next();
});

// Method to check availability on a date
doctorScheduleSchema.methods.getAvailableTimeSlots = function() {
  return this.timeSlots.filter(slot => slot.status === 'available');
};

// Method to check if a time range is available
doctorScheduleSchema.methods.isTimeRangeAvailable = function(startTime, endTime) {
  // Convert input to Date objects if they are strings
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  // Check if time range falls within any available time slots
  for (const slot of this.timeSlots) {
    if (slot.status === 'available' && 
        slot.startTime <= start && 
        slot.endTime >= end) {
      return true;
    }
  }
  return false;
};

// Static method to find schedule by doctor and date range
doctorScheduleSchema.statics.findByDoctorAndDateRange = async function(doctorId, startDate, endDate) {
  return this.find({
    doctor: doctorId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort('date');
};

// Create models
const TimeSlot = mongoose.model('TimeSlot', timeSlotSchema);
const RecurringTemplate = mongoose.model('RecurringTemplate', recurringTemplateSchema);
const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);

module.exports = {
  TimeSlot,
  RecurringTemplate,
  DoctorSchedule
};
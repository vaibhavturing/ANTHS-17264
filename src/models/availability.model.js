// File: src/models/availability.model.js
const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Break Time Schema
 * Represents scheduled breaks within a doctor's working day
 */
const breakTimeSchema = new mongoose.Schema({
  // Doctor this break belongs to
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Date of this break
  date: {
    type: Date,
    required: true
  },
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
  // Reason for the break (e.g., 'Lunch', 'Administrative tasks')
  reason: {
    type: String,
    required: true,
    trim: true
  },
  // Is this a recurring break
  isRecurring: {
    type: Boolean,
    default: false
  },
  // Recurrence rule (if this is a recurring break)
  recurrenceRule: {
    type: String
  },
  // Status of this break
  status: {
    type: String,
    enum: ['scheduled', 'cancelled'],
    default: 'scheduled'
  },
  // Notes about this break
  notes: {
    type: String,
    trim: true
  }
}, baseSchema.baseOptions);

/**
 * Leave Schema
 * Represents vacation, sick leave, or other time off for doctors
 */
const leaveSchema = new mongoose.Schema({
  // Doctor this leave belongs to
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Type of leave
  leaveType: {
    type: String,
    enum: ['vacation', 'sick', 'conference', 'training', 'personal', 'other'],
    required: true
  },
  // Start date and time
  startDateTime: {
    type: Date,
    required: true
  },
  // End date and time
  endDateTime: {
    type: Date,
    required: true
  },
  // All-day flag
  isAllDay: {
    type: Boolean,
    default: true
  },
  // Status of the leave request
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  // Approval information
  approval: {
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    notes: {
      type: String,
      trim: true
    }
  },
  // Leave request details
  description: {
    type: String,
    required: true,
    trim: true
  },
  // Emergency contact information during leave
  emergencyContact: {
    name: String,
    phone: String,
    email: String
  },
  // Alternative coverage arrangements
  coverageArrangements: {
    coveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  },
  // Documents attached to the leave request (e.g., doctor's note for sick leave)
  attachments: [{
    fileName: String,
    fileType: String,
    fileSize: Number,
    filePath: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Notes about this leave
  notes: {
    type: String,
    trim: true
  }
}, baseSchema.baseOptions);

/**
 * Availability Schema
 * Represents a doctor's overall availability for scheduling appointments
 */
const availabilitySchema = new mongoose.Schema({
  // Doctor this availability belongs to
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Effective date range for this availability record
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveUntil: {
    type: Date
  },
  // Status of this availability record
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  // Overall availability pattern description
  description: {
    type: String,
    trim: true
  },
  // Weekly recurring schedule (references to RecurringTemplate)
  recurringSchedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RecurringTemplate'
  },
  // Maximum appointments per day
  maxAppointmentsPerDay: {
    type: Number,
    min: 1,
    default: 20
  },
  // Appointment types this doctor is available for
  availableAppointmentTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType'
  }],
  // Locations where this doctor is available
  availableLocations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location'
  }],
  // Buffer time between appointments (in minutes, can override appointment type defaults)
  defaultBufferTime: {
    type: Number,
    default: 0,
    min: 0
  },
  // Minimum advance notice required for bookings (in hours)
  minimumNoticeTime: {
    type: Number,
    default: 24,
    min: 0
  },
  // Maximum advance booking window (in days)
  maximumBookingWindow: {
    type: Number,
    default: 60,
    min: 1
  }
}, baseSchema.baseOptions);

// Compound index for date range queries
availabilitySchema.index({ doctor: 1, effectiveFrom: 1, effectiveUntil: 1 });

// Pre-save middleware to validate date ranges
availabilitySchema.pre('save', function(next) {
  if (this.effectiveUntil && this.effectiveFrom > this.effectiveUntil) {
    const error = new Error('Effective start date must be before end date');
    logger.error('Invalid availability date range', {
      doctorId: this.doctor,
      effectiveFrom: this.effectiveFrom,
      effectiveUntil: this.effectiveUntil
    });
    return next(error);
  }
  
  next();
});

// Create models
const BreakTime = mongoose.model('BreakTime', breakTimeSchema);
const Leave = mongoose.model('Leave', leaveSchema);
const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = {
  BreakTime,
  Leave,
  Availability
};
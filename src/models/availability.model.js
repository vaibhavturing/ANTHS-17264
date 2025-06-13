const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Leave Schema
 * For tracking doctor vacation, sick leave, or other time off
 */
const leaveSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['vacation', 'sick', 'personal', 'professional', 'other'],
    default: 'vacation'
  },
  description: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value >= this.startDate;
      },
      message: 'End date must be greater than or equal to start date'
    }
  },
  allDay: {
    type: Boolean,
    default: true
  },
  // For partial day leave (when allDay is false)
  startTime: {
    type: String,
    validate: {
      validator: function(value) {
        return !this.allDay || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      },
      message: 'Start time must be in 24-hour format (HH:MM)'
    }
  },
  endTime: {
    type: String,
    validate: {
      validator: function(value) {
        return !this.allDay || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      },
      message: 'End time must be in 24-hour format (HH:MM)'
    }
  },
  // Approval status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  // If rejected, reason for rejection
  rejectionReason: {
    type: String,
    trim: true
  },
  // If approved, who approved it
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Date when leave was approved or rejected
  statusUpdatedAt: {
    type: Date
  },
  // Flag to track if affected appointments have been handled
  affectedAppointmentsProcessed: {
    type: Boolean,
    default: false
  },
  // Reference to the notification sent to staff about affected appointments
  notificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification'
  },
  // Color for calendar display
  color: {
    type: String,
    default: '#e74c3c', // Default red color for leave
    validate: {
      validator: function(v) {
        return /^#[0-9A-Fa-f]{6}$/.test(v); // Validate hex color
      },
      message: props => `${props.value} is not a valid hex color!`
    }
  }
}, baseSchema.baseOptions);

/**
 * Break Time Schema
 * For tracking doctor regular breaks (lunch, admin time, etc.)
 */
const breakTimeSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // Day of week (0 = Sunday, 1 = Monday, etc.)
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6,
    required: true
  },
  startTime: {
    type: String,
    required: true,
    validate: {
      validator: function(value) {
        return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      },
      message: 'Start time must be in 24-hour format (HH:MM)'
    }
  },
  endTime: {
    type: String,
    required: true,
    validate: {
      validator: function(value) {
        return /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
      },
      message: 'End time must be in 24-hour format (HH:MM)'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Color for calendar display
  color: {
    type: String,
    default: '#f39c12', // Default orange color for break
    validate: {
      validator: function(v) {
        return /^#[0-9A-Fa-f]{6}$/.test(v); // Validate hex color
      },
      message: props => `${props.value} is not a valid hex color!`
    }
  },
  // Optional date range for this break
  // If not set, the break is considered recurring indefinitely
  effectiveFrom: {
    type: Date
  },
  effectiveTo: {
    type: Date
  }
}, baseSchema.baseOptions);

/**
 * Availability Schema
 * Master schema for doctor availability including reference to leaves and breaks
 */
const availabilitySchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
    unique: true
  },
  // Regular working hours
  workingHours: [{
    // Day of week (0 = Sunday, 1 = Monday, etc.)
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: true
    },
    // Is this a working day?
    isWorking: {
      type: Boolean,
      default: true
    },
    startTime: {
      type: String,
      required: function() {
        return this.isWorking;
      },
      validate: {
        validator: function(value) {
          return !this.isWorking || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: 'Start time must be in 24-hour format (HH:MM)'
      }
    },
    endTime: {
      type: String,
      required: function() {
        return this.isWorking;
      },
      validate: {
        validator: function(value) {
          return !this.isWorking || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: 'End time must be in 24-hour format (HH:MM)'
      }
    }
  }],
  // Special dates (holidays, different working hours, etc.)
  specialDates: [{
    date: {
      type: Date,
      required: true
    },
    // Is this a working day?
    isWorking: {
      type: Boolean,
      default: false
    },
    startTime: {
      type: String,
      validate: {
        validator: function(value) {
          return !this.isWorking || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: 'Start time must be in 24-hour format (HH:MM)'
      }
    },
    endTime: {
      type: String,
      validate: {
        validator: function(value) {
          return !this.isWorking || /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
        },
        message: 'End time must be in 24-hour format (HH:MM)'
      }
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    color: {
      type: String,
      default: '#3498db', // Default blue color for special dates
      validate: {
        validator: function(v) {
          return /^#[0-9A-Fa-f]{6}$/.test(v); // Validate hex color
        },
        message: props => `${props.value} is not a valid hex color!`
      }
    }
  }]
}, baseSchema.baseOptions);

// Method to check if a doctor is available on a specific date and time
availabilitySchema.methods.isDoctorAvailable = async function(date, startTime, endTime) {
  try {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const formattedDate = dateObj.toISOString().split('T')[0];
    
    // Check if it's a special date
    const specialDate = this.specialDates.find(
      sd => new Date(sd.date).toISOString().split('T')[0] === formattedDate
    );
    
    if (specialDate && !specialDate.isWorking) {
      return false; // Not a working day
    }
    
    // Use special date hours if exists, otherwise use regular working hours
    let workingDay;
    if (specialDate && specialDate.isWorking) {
      workingDay = {
        startTime: specialDate.startTime,
        endTime: specialDate.endTime
      };
    } else {
      workingDay = this.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
      if (!workingDay || !workingDay.isWorking) {
        return false; // Not a working day
      }
    }
    
    // Check if the requested time is within working hours
    if (startTime < workingDay.startTime || endTime > workingDay.endTime) {
      return false; // Outside working hours
    }
    
    // Check if there is a leave scheduled for this date
    const Leave = mongoose.model('Leave');
    const leaves = await Leave.find({
      doctorId: this.doctorId,
      status: 'approved',
      startDate: { $lte: dateObj },
      endDate: { $gte: dateObj }
    });
    
    if (leaves.length > 0) {
      // For each leave, check if it affects the requested time
      for (const leave of leaves) {
        if (leave.allDay) {
          return false; // All day leave, doctor not available
        }
        
        // For partial day leave, check if the requested time overlaps with leave time
        if (startTime < leave.endTime && endTime > leave.startTime) {
          return false; // Overlap with leave time
        }
      }
    }
    
    // Check if there are breaks during the requested time
    const BreakTime = mongoose.model('BreakTime');
    const breaks = await BreakTime.find({
      doctorId: this.doctorId,
      dayOfWeek: dayOfWeek,
      isActive: true,
      // If effectiveFrom and effectiveTo are set, check if the date is within that range
      $or: [
        { effectiveFrom: { $exists: false } },
        { effectiveFrom: null },
        { effectiveFrom: { $lte: dateObj } }
      ],
      $or: [
        { effectiveTo: { $exists: false } },
        { effectiveTo: null },
        { effectiveTo: { $gte: dateObj } }
      ]
    });
    
    if (breaks.length > 0) {
      // For each break, check if it overlaps with the requested time
      for (const breakTime of breaks) {
        if (startTime < breakTime.endTime && endTime > breakTime.startTime) {
          return false; // Overlap with break time
        }
      }
    }
    
    // If all checks pass, the doctor is available
    return true;
  } catch (error) {
    logger.error('Error checking doctor availability', { error: error.message, doctorId: this.doctorId });
    throw error;
  }
};

// Compile models
const Leave = mongoose.model('Leave', leaveSchema);
const BreakTime = mongoose.model('BreakTime', breakTimeSchema);
const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = {
  Leave,
  BreakTime,
  Availability
};
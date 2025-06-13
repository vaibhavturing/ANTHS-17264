const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

/**
 * Schema for recurring appointment series in the Healthcare Management Application
 * This model manages the series of recurring appointments
 */
const recurringAppointmentSeriesSchema = new mongoose.Schema({
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
  // Frequency of the recurring appointments
  frequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly', 'custom'],
    required: true
  },
  // Custom interval in days (for custom frequency)
  customIntervalDays: {
    type: Number,
    min: 1,
    max: 365,
    validate: {
      validator: function(val) {
        return this.frequency !== 'custom' || (val && val > 0);
      },
      message: 'Custom interval days is required for custom frequency'
    }
  },
  // Day of week for weekly/biweekly appointments (0 = Sunday, 1 = Monday, etc.)
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6,
    validate: {
      validator: function(val) {
        return !['weekly', 'biweekly'].includes(this.frequency) || (val >= 0 && val <= 6);
      },
      message: 'Day of week is required for weekly or biweekly frequency'
    }
  },
  // Day of month for monthly appointments
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31,
    validate: {
      validator: function(val) {
        return this.frequency !== 'monthly' || (val >= 1 && val <= 31);
      },
      message: 'Day of month is required for monthly frequency and must be between 1 and 31'
    }
  },
  // Use same day of week for monthly instead of exact date
  useSameDayOfWeekMonthly: {
    type: Boolean,
    default: false
  },
  // Time of day for the appointments (HH:MM format)
  timeOfDay: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Time must be in 24-hour HH:MM format'
    }
  },
  // Series start and end dates
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(val) {
        return val > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  // Maximum number of occurrences (alternative to end date)
  occurrences: {
    type: Number,
    min: 1,
    max: 52 // Limit to 1 year of weekly appointments
  },
  // Original duration from appointment type
  duration: {
    type: Number, // Duration in minutes
    required: true,
    min: 5
  },
  // Series status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'partially_cancelled'],
    default: 'active'
  },
  // General notes for all appointments in series
  notes: {
    type: String,
    trim: true
  },
  // IDs of all appointments in this series
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  // Exceptions - dates when recurring appointments should be skipped
  exceptions: [Date],
  // Skip national holidays
  skipHolidays: {
    type: Boolean,
    default: true
  },
  // Auto-reschedule if slot unavailable
  autoReschedule: {
    type: Boolean,
    default: false
  },
  // For auto-rescheduled appointments, how many days to look ahead
  rescheduleWindowDays: {
    type: Number,
    default: 3,
    min: 0,
    max: 14
  }
}, baseSchema.baseOptions);

// Index for efficient querying
recurringAppointmentSeriesSchema.index({ patient: 1, status: 1 });
recurringAppointmentSeriesSchema.index({ doctor: 1, status: 1 });
recurringAppointmentSeriesSchema.index({ startDate: 1, endDate: 1 });

// Virtual for count of future appointments
recurringAppointmentSeriesSchema.virtual('futureAppointmentsCount').get(function() {
  if (!this.appointments) return 0;
  
  const now = new Date();
  return this.appointments.filter(appt => appt.startTime > now).length;
});

// Method to check if a date should be skipped
recurringAppointmentSeriesSchema.methods.shouldSkipDate = function(date) {
  // Check if date is in exceptions
  if (this.exceptions && this.exceptions.some(exc => 
    exc.getFullYear() === date.getFullYear() && 
    exc.getMonth() === date.getMonth() && 
    exc.getDate() === date.getDate()
  )) {
    return true;
  }
  
  // Check if date is on a weekend (if configured to skip weekends)
  if (this.skipWeekends && (date.getDay() === 0 || date.getDay() === 6)) {
    return true;
  }
  
  return false;
};

const RecurringAppointmentSeries = mongoose.model('RecurringAppointmentSeries', recurringAppointmentSeriesSchema);

module.exports = RecurringAppointmentSeries;
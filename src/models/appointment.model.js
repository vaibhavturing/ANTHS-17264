/**
 * Healthcare Management Application
 * Appointment Model
 * 
 * Schema for patient appointments including scheduling info, status tracking, 
 * and visit details
 */

const mongoose = require('mongoose');
const { createSchema } = require('./baseSchema');

/**
 * Valid appointment status values
 */
const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled'
};

/**
 * Valid appointment types
 */
const APPOINTMENT_TYPES = {
  NEW_PATIENT: 'new_patient',
  FOLLOW_UP: 'follow_up',
  CONSULTATION: 'consultation',
  ANNUAL_PHYSICAL: 'annual_physical',
  PROCEDURE: 'procedure',
  VACCINATION: 'vaccination',
  URGENT_CARE: 'urgent_care',
  TELEMEDICINE: 'telemedicine',
  LAB_WORK: 'lab_work',
  IMAGING: 'imaging'
};

/**
 * Appointment schema definition
 */
const appointmentSchema = createSchema({
  // Patient information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient is required']
  },
  
  // Provider information (doctor, nurse, etc.)
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Provider is required']
  },
  
  // Scheduling information
  scheduledDateTime: {
    type: Date,
    required: [true, 'Appointment date and time is required'],
    validate: {
      validator: function(date) {
        return date > new Date();
      },
      message: 'Appointment date must be in the future'
    }
  },
  
  endDateTime: {
    type: Date,
    validate: {
      validator: function(date) {
        return date > this.scheduledDateTime;
      },
      message: 'End time must be after start time'
    }
  },
  
  // Duration in minutes (computed or explicit)
  duration: {
    type: Number,
    min: [5, 'Appointment must be at least 5 minutes long'],
    default: 30
  },
  
  // Appointment type and details
  type: {
    type: String,
    required: [true, 'Appointment type is required'],
    enum: {
      values: Object.values(APPOINTMENT_TYPES),
      message: 'Invalid appointment type'
    }
  },
  
  status: {
    type: String,
    enum: Object.values(APPOINTMENT_STATUS),
    default: APPOINTMENT_STATUS.SCHEDULED
  },
  
  // Why the patient is coming in
  purpose: {
    type: String,
    required: [true, 'Appointment purpose is required']
  },
  
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  // Indicates if this is a recurring appointment
  isRecurring: {
    type: Boolean,
    default: false
  },
  
  // For recurring appointments
  recurringPattern: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly']
    },
    endDate: Date,
    daysOfWeek: [Number], // 0 = Sunday, 1 = Monday, etc.
    occurrences: Number
  },
  
  // Parent appointment if part of a series
  recurringParent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },

  // Facility/Location information
  location: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Facility',
    required: [true, 'Appointment location is required']
  },
  
  room: String,

  // Check-in information
  checkInTime: Date,
  
  // Billing information
  billing: {
    insuranceVerified: {
      type: Boolean,
      default: false
    },
    copayAmount: Number,
    copayCollected: {
      type: Boolean,
      default: false
    },
    estimatedCost: Number,
    billingStatus: {
      type: String,
      enum: ['pending', 'billed', 'paid', 'adjusted', 'denied', 'write-off']
    }
  },
  
  // Reminders
  reminders: [{
    sentAt: Date,
    method: {
      type: String,
      enum: ['email', 'sms', 'phone']
    },
    successful: Boolean
  }],
  
  // Cancellation details
  cancellation: {
    cancelledAt: Date,
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    rescheduleStatus: {
      type: String,
      enum: ['not_requested', 'requested', 'rescheduled']
    }
  }
});

// Indexes for performance
appointmentSchema.index({ patient: 1, scheduledDateTime: 1 });
appointmentSchema.index({ provider: 1, scheduledDateTime: 1 });
appointmentSchema.index({ scheduledDateTime: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ type: 1 });
appointmentSchema.index({ location: 1 });

// Virtual field for appointment status check
appointmentSchema.virtual('isUpcoming').get(function() {
  return (
    this.scheduledDateTime > new Date() && 
    this.status !== APPOINTMENT_STATUS.CANCELLED && 
    this.status !== APPOINTMENT_STATUS.RESCHEDULED
  );
});

// Pre-save validation
appointmentSchema.pre('save', function(next) {
  // Set end time if not provided
  if (!this.endDateTime && this.scheduledDateTime && this.duration) {
    this.endDateTime = new Date(this.scheduledDateTime.getTime() + this.duration * 60000);
  }
  
  next();
});

// Pre-find hooks to populate references
appointmentSchema.pre(/^find/, function(next) {
  // Populate related models
  this.populate({
    path: 'patient',
    select: 'mrn userId'
  })
  .populate({
    path: 'provider',
    select: 'userId specialty'
  })
  .populate({
    path: 'location',
    select: 'name address'
  });
  
  next();
});

// Methods
/**
 * Check in a patient for their appointment
 * @returns {Promise} Updated appointment document
 */
appointmentSchema.methods.checkIn = async function() {
  this.status = APPOINTMENT_STATUS.CHECKED_IN;
  this.checkInTime = new Date();
  return await this.save();
};

/**
 * Start an appointment
 * @returns {Promise} Updated appointment document
 */
appointmentSchema.methods.startAppointment = async function() {
  this.status = APPOINTMENT_STATUS.IN_PROGRESS;
  return await this.save();
};

/**
 * Complete an appointment
 * @param {string} notes - Optional notes from the appointment
 * @returns {Promise} Updated appointment document
 */
appointmentSchema.methods.completeAppointment = async function(notes) {
  this.status = APPOINTMENT_STATUS.COMPLETED;
  if (notes) {
    this.notes = notes;
  }
  return await this.save();
};

/**
 * Cancel an appointment
 * @param {ObjectId} userId - ID of user cancelling the appointment
 * @param {string} reason - Reason for cancellation
 * @returns {Promise} Updated appointment document
 */
appointmentSchema.methods.cancelAppointment = async function(userId, reason) {
  this.status = APPOINTMENT_STATUS.CANCELLED;
  this.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: userId,
    reason: reason,
    rescheduleStatus: 'not_requested'
  };
  return await this.save();
};

/**
 * Reschedule an appointment
 * @param {Date} newDateTime - New appointment date and time
 * @param {ObjectId} userId - ID of user rescheduling the appointment
 * @param {string} reason - Reason for rescheduling
 * @returns {Promise} Updated appointment document
 */
appointmentSchema.methods.rescheduleAppointment = async function(newDateTime, userId, reason) {
  // Store original date for record keeping
  const originalDate = this.scheduledDateTime;
  
  // Update with new date
  this.scheduledDateTime = newDateTime;
  this.endDateTime = new Date(newDateTime.getTime() + this.duration * 60000);
  this.status = APPOINTMENT_STATUS.RESCHEDULED;
  
  // Record the change
  this.cancellation = {
    cancelledAt: new Date(),
    cancelledBy: userId,
    reason: reason || 'Rescheduled',
    rescheduleStatus: 'rescheduled'
  };
  
  return await this.save();
};

// Create the model
const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = {
  Appointment,
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPES
};
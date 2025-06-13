const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

/**
 * Appointment Schema
 * Stores information about scheduled appointments
 */
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
  appointmentType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AppointmentType',
    required: true
  },
  // Start time of the appointment
  startTime: {
    type: Date,
    required: true
  },
  // End time is calculated from the duration
  endTime: {
    type: Date,
    required: true
  },
  // Duration in minutes (this may differ from appointmentType.duration due to doctor-specific settings)
  duration: {
    type: Number,
    required: true,
    min: 5,
    max: 240, // Max 4 hours
    default: 30
  },
  // Buffer time in minutes after this appointment
  bufferTime: {
    type: Number,
    min: 0,
    max: 60, // Max 1 hour buffer
    default: 0
  },
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  cancelledBy: {
    type: String,
    enum: ['patient', 'doctor', 'admin', null],
    default: null
  },
  cancellationReason: {
    type: String
  },
  notes: {
    type: String
  },
  // Has the patient checked in?
  checkedIn: {
    type: Boolean,
    default: false
  },
  // When did the patient check in?
  checkInTime: {
    type: Date
  },
  // Is this a recurring appointment?
  isRecurring: {
    type: Boolean,
    default: false
  },
  // For recurring appointments
  recurringPattern: {
    type: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly']
      },
      interval: {
        type: Number,
        min: 1,
        default: 1
      },
      daysOfWeek: [{
        type: Number,
        min: 0,
        max: 6
      }],
      endsOn: {
        type: Date
      },
      occurrences: {
        type: Number,
        min: 1
      }
    }
  },
  // Is this a virtual appointment?
  isVirtual: {
    type: Boolean,
    default: false
  },
  // Virtual meeting details
  virtualMeetingDetails: {
    type: {
      platform: {
        type: String,
        enum: ['zoom', 'teams', 'google-meet', 'other']
      },
      meetingId: {
        type: String
      },
      meetingPassword: {
        type: String
      },
      meetingLink: {
        type: String
      }
    }
  },
  // Has the meeting link been sent to the patient?
  meetingLinkSent: {
    type: Boolean,
    default: false
  },
  // Original appointment for rescheduled appointments
  originalAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  
  // NEW FIELDS: Added for emergency schedule management
  // Reference to an appointment this was rescheduled to (if this one was cancelled)
  rescheduledToAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  
  // Who rescheduled this appointment
  rescheduledBy: {
    type: String,
    enum: ['patient', 'doctor', 'admin', null],
    default: null
  },
  
  // ID of user who performed the rescheduling
  rescheduledByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // When was the appointment rescheduled
  rescheduledAt: {
    type: Date
  },
  
  // Reference to emergency leave that caused this appointment to be cancelled/rescheduled
  emergencyLeaveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Leave'
  },
  
  // Was patient notified about emergency changes
  emergencyNotificationSent: {
    type: Boolean,
    default: false
  },
  
  // When was the emergency notification sent
  emergencyNotificationSentAt: {
    type: Date
  }
}, baseSchema.baseOptions);

// Calculate the actualEndTime (including buffer time)
appointmentSchema.virtual('actualEndTime').get(function() {
  if (!this.endTime) return null;
  
  const endTimeMs = new Date(this.endTime).getTime();
  const bufferTimeMs = (this.bufferTime || 0) * 60 * 1000; // Convert minutes to milliseconds
  
  return new Date(endTimeMs + bufferTimeMs);
});

// Pre-save hook to calculate the end time from the start time and duration
appointmentSchema.pre('save', function(next) {
  if (this.startTime && this.duration) {
    const startMs = new Date(this.startTime).getTime();
    const durationMs = this.duration * 60 * 1000; // Convert minutes to milliseconds
    this.endTime = new Date(startMs + durationMs);
  }
  
  // NEW: Add timestamp when appointment is rescheduled
  if (this.isModified('rescheduledBy') && this.rescheduledBy) {
    this.rescheduledAt = new Date();
  }
  
  // NEW: Add timestamp when emergency notification is sent
  if (this.isModified('emergencyNotificationSent') && this.emergencyNotificationSent) {
    this.emergencyNotificationSentAt = new Date();
  }
  
  next();
});

// Static method to check if a time slot is available for a doctor
appointmentSchema.statics.isTimeSlotAvailable = async function(doctorId, startTime, endTime, excludeAppointmentId = null) {
  try {
    const query = {
      doctor: doctorId,
      status: { $nin: ['cancelled', 'no-show'] },
      $or: [
        // New appointment starts during an existing appointment (including buffer time)
        {
          startTime: { $lt: endTime },
          $expr: {
            $gt: [
              { $add: ["$endTime", { $multiply: ["$bufferTime", 60 * 1000] }] },
              new Date(startTime).getTime()
            ]
          }
        },
        // New appointment ends during an existing appointment
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    };

    // If updating an existing appointment, exclude it from the check
    if (excludeAppointmentId) {
      query._id = { $ne: excludeAppointmentId };
    }

    const conflictingAppointments = await this.find(query);
    return conflictingAppointments.length === 0;
  } catch (error) {
    logger.error('Error in isTimeSlotAvailable', { 
      error: error.message,
      doctorId,
      startTime,
      endTime,
      excludeAppointmentId
    });
    throw error;
  }
};

// NEW: Static method to find appointments affected by emergency leave
appointmentSchema.statics.findAffectedByEmergency = async function(doctorId, startDate, endDate) {
  try {
    return await this.find({
      doctor: doctorId,
      status: { $nin: ['cancelled', 'completed', 'no-show'] },
      startTime: { $gte: startDate },
      endTime: { $lte: endDate }
    }).populate('patient', 'firstName lastName email phone')
      .populate('appointmentType', 'name duration bufferTime')
      .sort({ startTime: 1 });
  } catch (error) {
    logger.error('Error finding appointments affected by emergency', { 
      error: error.message,
      doctorId,
      startDate,
      endDate
    });
    throw error;
  }
};

// Ensure the model includes virtual properties when converted to JSON
appointmentSchema.set('toJSON', { virtuals: true });
appointmentSchema.set('toObject', { virtuals: true });

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
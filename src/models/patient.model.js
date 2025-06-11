// src/models/patient.model.js
const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

const patientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNumber: String
  },
  medicalHistory: {
    allergies: [String],
    chronicConditions: [String],
    currentMedications: [{
      name: String,
      dosage: String,
      frequency: String
    }],
    pastSurgeries: [{
      procedure: String,
      date: Date,
      notes: String
    }]
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    primaryInsured: String,
    relationship: String,
    expirationDate: Date
  },
  // New fields for appointment integration
  preferredDoctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  }],
  preferredTimeSlots: [{
    dayOfWeek: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    },
    startTime: String, // Format: "HH:MM" in 24-hour format
    endTime: String    // Format: "HH:MM" in 24-hour format
  }],
  appointmentHistory: [{
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment'
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no_show']
    },
    date: Date
  }],
  noShowCount: {
    type: Number,
    default: 0
  },
  consentRecords: [{
    type: { type: String },
    givenDate: Date,
    expirationDate: Date,
    documentPath: String
  }],
  communicationPreferences: {
    appointmentReminders: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false }
    },
    marketingCommunications: {
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false }
    },
    preferredLanguage: {
      type: String,
      default: 'English'
    }
  }
}, baseSchema.baseOptions);

// Index for efficient searching by user ID
patientSchema.index({ user: 1 });

// Index for searching by preferred doctors
patientSchema.index({ preferredDoctors: 1 });

// Virtual for full name
patientSchema.virtual('fullName').get(function() {
  return `${this.user.firstName} ${this.user.lastName}`;
});

// Method to check if patient has a conflict with proposed appointment time
patientSchema.methods.hasAppointmentConflict = async function(startTime, endTime) {
  const Appointment = mongoose.model('Appointment');
  const overlappingAppointments = await Appointment.find({
    patient: this._id,
    status: 'scheduled',
    $or: [
      { // New appointment starts during an existing appointment
        startTime: { $lte: startTime },
        endTime: { $gt: startTime }
      },
      { // New appointment ends during an existing appointment
        startTime: { $lt: endTime },
        endTime: { $gte: endTime }
      },
      { // New appointment encompasses an existing appointment
        startTime: { $gte: startTime },
        endTime: { $lte: endTime }
      }
    ]
  }).exec();
  
  return overlappingAppointments.length > 0;
};

// Method to add appointment to history
patientSchema.methods.addToAppointmentHistory = function(appointmentId, status) {
  this.appointmentHistory.push({
    appointmentId,
    status,
    date: new Date()
  });
  
  if (status === 'no_show') {
    this.noShowCount += 1;
  }
  
  return this.save();
};

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
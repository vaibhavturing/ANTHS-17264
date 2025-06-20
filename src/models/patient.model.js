// src/models/patient.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const patientSchema = new Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    required: true
  },
  contactInformation: {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String
    }
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  insuranceInformation: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    coverageDetails: String
  },
  medicalHistory: {
    allergies: [{
      allergen: String,
      severity: String,
      reaction: String
    }],
    chronicConditions: [String],
    surgeries: [{
      procedure: String,
      date: Date,
      notes: String
    }],
    familyHistory: [String]
  },
  primaryCareProvider: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'deceased'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  }
});

// ADDED INDEXES FOR PERFORMANCE OPTIMIZATION
// Index for name-based searches
patientSchema.index({ firstName: 1, lastName: 1 });

// Index for date of birth searches
patientSchema.index({ dateOfBirth: 1 });

// Index for primary care provider lookups
patientSchema.index({ primaryCareProvider: 1 });

// Index for insurance provider searches
patientSchema.index({ 'insuranceInformation.provider': 1 });

// Text index for full-text search
patientSchema.index(
  { firstName: 'text', lastName: 'text', 'medicalHistory.chronicConditions': 'text', notes: 'text' },
  { weights: { firstName: 10, lastName: 10, 'medicalHistory.chronicConditions': 5, notes: 1 } }
);

// Compound index for status + date
patientSchema.index({ status: 1, createdAt: -1 });

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
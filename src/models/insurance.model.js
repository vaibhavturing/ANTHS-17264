const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

// Schema for Insurance Plans offered by providers
const insurancePlanSchema = new mongoose.Schema({
  planName: {
    type: String,
    required: true,
    trim: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceProvider',
    required: true
  },
  coverageDetails: {
    type: Object,
    required: true,
    default: {}
  },
  planType: {
    type: String,
    enum: ['HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'Other'],
    required: true
  },
  deductible: {
    type: Number,
    required: true,
    min: 0
  },
  coPayAmount: {
    type: Number,
    required: true,
    min: 0
  },
  coveragePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  outOfPocketMax: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, baseSchema.baseOptions);

// Schema for Insurance Providers
const insuranceProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactPhone: {
    type: String,
    required: true
  },
  contactEmail: {
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
  verificationEndpoint: {
    type: String,
    trim: true
  },
  claimsEndpoint: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, baseSchema.baseOptions);

// Schema for Patient Insurance
const patientInsuranceSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceProvider',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsurancePlan'
  },
  memberNumber: {
    type: String,
    required: true,
    trim: true
  },
  groupNumber: {
    type: String,
    trim: true
  },
  policyHolder: {
    name: String,
    relationship: {
      type: String,
      enum: ['self', 'spouse', 'child', 'other'],
      default: 'self'
    },
    dateOfBirth: Date
  },
  effectiveDate: {
    type: Date,
    required: true
  },
  expirationDate: Date,
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },
  verificationDate: Date,
  verificationDetails: Object,
  isPrimary: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  coverageDetails: Object
}, baseSchema.baseOptions);

// Create models
const InsurancePlan = mongoose.model('InsurancePlan', insurancePlanSchema);
const InsuranceProvider = mongoose.model('InsuranceProvider', insuranceProviderSchema);
const PatientInsurance = mongoose.model('PatientInsurance', patientInsuranceSchema);

module.exports = {
  InsurancePlan,
  InsuranceProvider,
  PatientInsurance
};
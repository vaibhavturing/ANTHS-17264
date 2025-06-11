const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

// Schema for Billing
const billingSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  insuranceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientInsurance'
  },
  insuranceCoverage: {
    type: Number,
    default: 0,
    min: 0
  },
  patientResponsibility: {
    type: Number,
    required: true,
    min: 0
  },
  coPayAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  billStatus: {
    type: String,
    enum: ['draft', 'pending', 'submitted', 'paid', 'partially_paid', 'overdue', 'declined'],
    default: 'draft'
  },
  dueDate: {
    type: Date,
    required: true
  },
  billingDate: {
    type: Date,
    default: Date.now
  },
  notes: String,
  billingCode: {
    type: String,
    required: true
  },
  diagnosisCodes: [{
    type: String
  }],
  procedureCodes: [{
    type: String
  }]
}, baseSchema.baseOptions);

// Schema for Insurance Claims
const insuranceClaimSchema = new mongoose.Schema({
  billingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Billing',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  patientInsuranceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientInsurance',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceProvider',
    required: true
  },
  claimNumber: {
    type: String,
    trim: true
  },
  claimDate: {
    type: Date,
    default: Date.now
  },
  claimStatus: {
    type: String,
    enum: ['pending', 'submitted', 'in_review', 'approved', 'partially_approved', 'denied', 'appealed'],
    default: 'pending'
  },
  claimAmount: {
    type: Number,
    required: true,
    min: 0
  },
  approvedAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  denialReason: String,
  submissionDate: Date,
  responseDate: Date,
  notes: String,
  attachments: [{
    filename: String,
    path: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }]
}, baseSchema.baseOptions);

// Schema for Payments
const paymentSchema = new mongoose.Schema({
  billingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Billing',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'insurance', 'electronic_transfer', 'check', 'other'],
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  transactionId: String,
  receiptNumber: String,
  notes: String,
  paymentSource: {
    type: String,
    enum: ['patient', 'insurance', 'other'],
    default: 'patient'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed'
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  refundDate: Date,
  refundReason: String
}, baseSchema.baseOptions);

// Schema for Payment Plans
const paymentPlanSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  billingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Billing'
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  remainingBalance: {
    type: Number,
    required: true,
    min: 0
  },
  installmentAmount: {
    type: Number,
    required: true,
    min: 0
  },
  frequency: {
    type: String,
    enum: ['weekly', 'biweekly', 'monthly'],
    default: 'monthly'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  nextPaymentDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'defaulted', 'cancelled'],
    default: 'active'
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'electronic_transfer', 'manual'],
    required: true
  },
  autoCharge: {
    type: Boolean,
    default: false
  },
  notes: String,
  numberOfInstallments: {
    type: Number,
    required: true,
    min: 1
  },
  installmentsPaid: {
    type: Number,
    default: 0
  }
}, baseSchema.baseOptions);

// Create models
const Billing = mongoose.model('Billing', billingSchema);
const InsuranceClaim = mongoose.model('InsuranceClaim', insuranceClaimSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const PaymentPlan = mongoose.model('PaymentPlan', paymentPlanSchema);

module.exports = {
  Billing,
  InsuranceClaim,
  Payment,
  PaymentPlan
};
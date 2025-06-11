const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

/**
 * Schema for storing cached analytics reports
 * This helps with performance by storing pre-computed analytics
 */
const analyticsReportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    required: true,
    enum: [
      'patient_demographics', 
      'health_trends', 
      'appointment_adherence', 
      'treatment_outcomes',
      'population_health'
    ]
  },
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  filteredBy: {
    department: String,
    doctorId: mongoose.Schema.Types.ObjectId,
    dateRange: {
      start: Date,
      end: Date
    },
    ageGroup: String,
    gender: String,
    diagnosisCodes: [String],
    treatmentCodes: [String]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days by default
  }
}, baseSchema.baseOptions);

// Index for efficient report retrieval
analyticsReportSchema.index({ reportType: 1, 'filteredBy.department': 1 });
analyticsReportSchema.index({ reportType: 1, 'filteredBy.doctorId': 1 });
analyticsReportSchema.index({ createdBy: 1 });
analyticsReportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for automatic cleanup

/**
 * Schema for tracking report exports (for audit and compliance purposes)
 */
const reportExportSchema = new mongoose.Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnalyticsReport',
    required: true
  },
  exportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  exportFormat: {
    type: String,
    enum: ['pdf', 'csv', 'excel', 'json'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  anonymized: {
    type: Boolean,
    default: true
  },
  ipAddress: String,
  userAgent: String,
  dataFields: [String] // Which fields were included in the export
}, baseSchema.baseOptions);

/**
 * Schema for storing metadata about treatment outcomes
 * This supplements medical records with standardized outcome data
 */
const treatmentOutcomeSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  medicalRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MedicalRecord',
    required: true
  },
  treatmentCode: {
    type: String,
    required: true
  },
  diagnosisCode: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: Date,
  status: {
    type: String,
    enum: ['ongoing', 'completed', 'discontinued', 'failed'],
    required: true
  },
  outcome: {
    type: String,
    enum: ['resolved', 'improved', 'unchanged', 'worsened', 'n/a'],
    required: true
  },
  effectivenessRating: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  sideEffects: [{
    description: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe']
    },
    actionTaken: String
  }],
  patientFeedback: {
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 10
    },
    comments: String
  },
  followupNeeded: {
    type: Boolean,
    default: false
  },
  notes: String
}, baseSchema.baseOptions);

// Index for efficient queries
treatmentOutcomeSchema.index({ patientId: 1, diagnosisCode: 1 });
treatmentOutcomeSchema.index({ patientId: 1, treatmentCode: 1 });
treatmentOutcomeSchema.index({ outcome: 1 });
treatmentOutcomeSchema.index({ diagnosisCode: 1, outcome: 1 });
treatmentOutcomeSchema.index({ treatmentCode: 1, outcome: 1 });

/**
 * Schema for tracking population health metrics
 */
const populationHealthMetricSchema = new mongoose.Schema({
  metricName: {
    type: String,
    required: true
  },
  metricType: {
    type: String,
    enum: [
      'disease_prevalence', 
      'vaccination_rate',
      'screening_rate', 
      'average_bmi',
      'average_blood_pressure',
      'chronic_condition_management',
      'medication_adherence',
      'readmission_rate',
      'wellness_visit_rate',
      'custom'
    ],
    required: true
  },
  metricValue: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  unit: String,
  date: {
    type: Date,
    default: Date.now
  },
  populationSegment: {
    ageRange: {
      min: Number,
      max: Number
    },
    gender: String,
    zipCode: String,
    insuranceType: String,
    diagnosisCodes: [String],
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'very_high']
    }
  },
  sampleSize: {
    type: Number,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100
  },
  source: {
    type: String,
    enum: ['ehr', 'claims', 'surveys', 'devices', 'external', 'calculated'],
    default: 'calculated'
  },
  metadata: mongoose.Schema.Types.Mixed
}, baseSchema.baseOptions);

// Index to help with time-series queries
populationHealthMetricSchema.index({ metricType: 1, date: 1 });
populationHealthMetricSchema.index({ 'populationSegment.zipCode': 1 });
populationHealthMetricSchema.index({ 'populationSegment.diagnosisCodes': 1 });

// Create and export the models
const AnalyticsReport = mongoose.model('AnalyticsReport', analyticsReportSchema);
const ReportExport = mongoose.model('ReportExport', reportExportSchema);
const TreatmentOutcome = mongoose.model('TreatmentOutcome', treatmentOutcomeSchema);
const PopulationHealthMetric = mongoose.model('PopulationHealthMetric', populationHealthMetricSchema);

module.exports = {
  AnalyticsReport,
  ReportExport,
  TreatmentOutcome,
  PopulationHealthMetric
};
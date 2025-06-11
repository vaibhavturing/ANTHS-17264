const Joi = require('joi');

// Validators for analytics-related operations
const analyticsValidators = {
  // Validate report generation request
  validateReportRequest: Joi.object({
    reportType: Joi.string().valid(
      'patient_demographics', 
      'health_trends', 
      'appointment_adherence', 
      'treatment_outcomes',
      'population_health'
    ).required()
      .messages({
        'any.required': 'Report type is required',
        'any.only': 'Invalid report type specified'
      }),
    filters: Joi.object({
      department: Joi.string().optional(),
      doctorId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional()
        .messages({
          'string.pattern.base': 'Doctor ID must be a valid MongoDB ObjectId'
        }),
      dateRange: Joi.object({
        start: Joi.date().iso().optional(),
        end: Joi.date().iso().min(Joi.ref('start')).optional()
          .messages({
            'date.min': 'End date must be after start date'
          })
      }).optional(),
      ageGroup: Joi.string().optional(),
      gender: Joi.string().valid('male', 'female', 'other', 'all').optional(),
      diagnosisCodes: Joi.array().items(Joi.string()).optional(),
      treatmentCodes: Joi.array().items(Joi.string()).optional(),
      zipCodes: Joi.array().items(Joi.string()).optional(),
      insuranceTypes: Joi.array().items(Joi.string()).optional()
    }).optional(),
    format: Joi.string().valid('json', 'pdf', 'csv', 'excel').default('json')
      .messages({
        'any.only': 'Invalid export format specified'
      }),
    includeFields: Joi.array().items(Joi.string()).optional()
      .messages({
        'array.base': 'Include fields must be an array'
      }),
    excludeFields: Joi.array().items(Joi.string()).optional()
      .messages({
        'array.base': 'Exclude fields must be an array'
      }),
    anonymized: Joi.boolean().default(true),
    aggregationLevel: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly', 'yearly').optional()
  }),

  // Validate report export tracking
  validateReportExport: Joi.object({
    reportId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Report ID must be a valid MongoDB ObjectId',
        'any.required': 'Report ID is required'
      }),
    exportFormat: Joi.string().valid('pdf', 'csv', 'excel', 'json').required()
      .messages({
        'any.only': 'Export format must be one of: pdf, csv, excel, json',
        'any.required': 'Export format is required'
      }),
    reason: Joi.string().min(5).max(200).required()
      .messages({
        'string.min': 'Reason must be at least {#limit} characters',
        'string.max': 'Reason cannot exceed {#limit} characters',
        'any.required': 'Reason for export is required'
      }),
    anonymized: Joi.boolean().default(true),
    dataFields: Joi.array().items(Joi.string()).optional()
  }),

  // Validate treatment outcome
  validateTreatmentOutcome: Joi.object({
    patientId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Patient ID must be a valid MongoDB ObjectId',
        'any.required': 'Patient ID is required'
      }),
    medicalRecordId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
      .messages({
        'string.pattern.base': 'Medical record ID must be a valid MongoDB ObjectId',
        'any.required': 'Medical record ID is required'
      }),
    treatmentCode: Joi.string().required()
      .messages({
        'any.required': 'Treatment code is required'
      }),
    diagnosisCode: Joi.string().required()
      .messages({
        'any.required': 'Diagnosis code is required'
      }),
    startDate: Joi.date().iso().required()
      .messages({
        'date.base': 'Start date must be a valid date',
        'any.required': 'Start date is required'
      }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
      .messages({
        'date.min': 'End date must be after start date'
      }),
    status: Joi.string().valid('ongoing', 'completed', 'discontinued', 'failed').required()
      .messages({
        'any.only': 'Status must be one of: ongoing, completed, discontinued, failed',
        'any.required': 'Status is required'
      }),
    outcome: Joi.string().valid('resolved', 'improved', 'unchanged', 'worsened', 'n/a').required()
      .messages({
        'any.only': 'Outcome must be one of: resolved, improved, unchanged, worsened, n/a',
        'any.required': 'Outcome is required'
      }),
    effectivenessRating: Joi.number().min(1).max(10).default(5),
    sideEffects: Joi.array().items(
      Joi.object({
        description: Joi.string().required(),
        severity: Joi.string().valid('mild', 'moderate', 'severe').required(),
        actionTaken: Joi.string().required()
      })
    ).optional(),
    patientFeedback: Joi.object({
      satisfactionRating: Joi.number().min(1).max(10).optional(),
      comments: Joi.string().optional()
    }).optional(),
    followupNeeded: Joi.boolean().default(false),
    notes: Joi.string().optional()
  }),

  // Validate population health metric
  validatePopulationHealthMetric: Joi.object({
    metricName: Joi.string().required()
      .messages({
        'any.required': 'Metric name is required'
      }),
    metricType: Joi.string().valid(
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
    ).required()
      .messages({
        'any.only': 'Invalid metric type specified',
        'any.required': 'Metric type is required'
      }),
    metricValue: Joi.alternatives().try(
      Joi.number(),
      Joi.object(),
      Joi.array()
    ).required()
      .messages({
        'any.required': 'Metric value is required'
      }),
    unit: Joi.string().optional(),
    date: Joi.date().iso().default(Date.now),
    populationSegment: Joi.object({
      ageRange: Joi.object({
        min: Joi.number().min(0).optional(),
        max: Joi.number().min(Joi.ref('min')).optional()
      }).optional(),
      gender: Joi.string().valid('male', 'female', 'other', 'all').optional(),
      zipCode: Joi.string().optional(),
      insuranceType: Joi.string().optional(),
      diagnosisCodes: Joi.array().items(Joi.string()).optional(),
      riskLevel: Joi.string().valid('low', 'medium', 'high', 'very_high').optional()
    }).optional(),
    sampleSize: Joi.number().min(1).required()
      .messages({
        'number.base': 'Sample size must be a number',
        'number.min': 'Sample size must be at least 1',
        'any.required': 'Sample size is required'
      }),
    confidence: Joi.number().min(0).max(100).optional(),
    source: Joi.string().valid('ehr', 'claims', 'surveys', 'devices', 'external', 'calculated').default('calculated'),
    metadata: Joi.object().optional()
  })
};
module.exports = analyticsValidators;

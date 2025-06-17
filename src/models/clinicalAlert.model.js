const mongoose = require('mongoose');
const { Schema } = mongoose;

const triggerConditionSchema = new Schema({
  // What triggers this alert
  type: {
    type: String,
    enum: [
      'diagnosis', 
      'medication', 
      'lab-result', 
      'patient-demographic', 
      'appointment-type',
      'seasonal',
      'custom'
    ],
    required: true
  },
  // Specific reference data based on type
  // For diagnosis: ICD-10 codes
  // For medication: medication IDs
  // For lab-result: abnormal result values
  // For patient-demographic: age, gender, etc.
  codes: [{
    type: String,
    required: true
  }],
  // Value ranges for numeric comparisons
  valueRange: {
    min: Number,
    max: Number,
    unit: String
  },
  // Additional conditions
  additionalCriteria: {
    type: Map,
    of: Schema.Types.Mixed
  }
});

const clinicalAlertSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: [
        'drug-interaction', 
        'preventive-care', 
        'diagnosis-alert', 
        'lab-alert', 
        'best-practice',
        'administrative'
      ],
      required: true
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info'
    },
    triggerConditions: [triggerConditionSchema],
    // Source of this guideline
    source: {
      name: {
        type: String,
        required: true
      },
      url: String,
      lastUpdated: Date
    },
    // Evidence level (for clinical guidelines)
    evidenceLevel: {
      type: String,
      enum: ['I', 'II', 'III', 'IV', 'V', 'expert-opinion', 'not-applicable'],
      default: 'not-applicable'
    },
    recommendedAction: {
      text: String,
      actionType: {
        type: String,
        enum: ['order-test', 'prescribe-medication', 'referral', 'vaccination', 'follow-up', 'education', 'other']
      },
      actionDetails: Schema.Types.Mixed
    },
    // Auto-dismissible alerts will close after a set time
    autoDismiss: {
      type: Boolean,
      default: false
    },
    dismissTimeout: {
      type: Number, // Seconds before auto-dismissal
      default: 0
    },
    // System-defined alerts can't be turned off completely
    isSystemDefined: {
      type: Boolean,
      default: false
    },
    // If this alert is active
    isActive: {
      type: Boolean,
      default: true
    },
    // Alert expiration
    expirationDate: {
      type: Date
    },
    // Departments this alert applies to
    applicableDepartments: [{
      type: String
    }],
    // Alert customization options
    customizationOptions: {
      canMute: {
        type: Boolean,
        default: true
      },
      canAdjustSeverity: {
        type: Boolean,
        default: false
      },
      canCustomizeText: {
        type: Boolean,
        default: false
      }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes for better query performance
clinicalAlertSchema.index({ category: 1, isActive: 1 });
clinicalAlertSchema.index({ 'triggerConditions.type': 1 });
clinicalAlertSchema.index({ 'source.name': 1 });
clinicalAlertSchema.index({ severity: 1 });

const ClinicalAlert = mongoose.model('ClinicalAlert', clinicalAlertSchema);

module.exports = ClinicalAlert;
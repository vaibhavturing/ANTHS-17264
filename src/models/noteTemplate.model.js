const mongoose = require('mongoose');
const baseSchema = require('./baseSchema');

// Schema for defining form fields in templates
const formFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  fieldType: {
    type: String,
    required: true,
    enum: ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'richtext']
  },
  required: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  options: [{
    label: String,
    value: String
  }],
  validation: {
    minLength: Number,
    maxLength: Number,
    min: Number,
    max: Number,
    pattern: String,
    customValidation: String // For advanced validation rules
  },
  order: {
    type: Number,
    default: 0
  },
  section: {
    type: String,
    default: 'general' 
  },
  helpText: {
    type: String
  }
});

// Schema for note templates
const noteTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  templateType: {
    type: String,
    required: true,
    enum: ['SOAP', 'Progress', 'Consultation', 'Discharge', 'Procedure', 'Physical', 'Mental', 'Custom'],
    default: 'SOAP'
  },
  specialty: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sections: [{
    name: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  fields: [formFieldSchema],
  autoPopulateFrom: [{
    sourceField: {
      type: String,
      required: true
    },
    targetField: {
      type: String,
      required: true
    },
    dataType: {
      type: String,
      enum: ['patient', 'appointment', 'vitals', 'labResult'],
      required: true
    }
  }]
}, {
  ...baseSchema.baseOptions,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for common queries
noteTemplateSchema.index({ templateType: 1, specialty: 1 });
noteTemplateSchema.index({ isActive: 1 });
noteTemplateSchema.index({ isDefault: 1 });

// Virtual for total number of fields
noteTemplateSchema.virtual('fieldCount').get(function() {
  return this.fields ? this.fields.length : 0;
});

// Static method for finding default templates
noteTemplateSchema.statics.findDefaultByType = async function(templateType) {
  return this.findOne({
    templateType,
    isDefault: true,
    isActive: true
  });
};

// Create predefined templates after model compilation
noteTemplateSchema.statics.createDefaultTemplates = async function(userId) {
  const defaults = [
    {
      name: 'Standard SOAP Note',
      description: 'Standard SOAP note template for general practice',
      templateType: 'SOAP',
      specialty: 'General Practice',
      isActive: true,
      isDefault: true,
      createdBy: userId,
      sections: [
        { name: 'subjective', label: 'Subjective', order: 1 },
        { name: 'objective', label: 'Objective', order: 2 },
        { name: 'assessment', label: 'Assessment', order: 3 },
        { name: 'plan', label: 'Plan', order: 4 }
      ],
      fields: [
        {
          name: 'chiefComplaint',
          label: 'Chief Complaint',
          fieldType: 'textarea',
          required: true,
          section: 'subjective',
          order: 1
        },
        {
          name: 'historyOfPresentIllness',
          label: 'History of Present Illness',
          fieldType: 'textarea',
          required: true,
          section: 'subjective',
          order: 2
        },
        {
          name: 'reviewOfSystems',
          label: 'Review of Systems',
          fieldType: 'textarea',
          section: 'subjective',
          order: 3
        },
        {
          name: 'vitalSigns',
          label: 'Vital Signs',
          fieldType: 'text',
          section: 'objective',
          order: 1
        },
        {
          name: 'physicalExamination',
          label: 'Physical Examination',
          fieldType: 'textarea',
          required: true,
          section: 'objective',
          order: 2
        },
        {
          name: 'labFindings',
          label: 'Laboratory Findings',
          fieldType: 'textarea',
          section: 'objective',
          order: 3
        },
        {
          name: 'diagnosis',
          label: 'Diagnosis',
          fieldType: 'textarea',
          required: true,
          section: 'assessment',
          order: 1
        },
        {
          name: 'clinicalImpression',
          label: 'Clinical Impression',
          fieldType: 'textarea',
          section: 'assessment',
          order: 2
        },
        {
          name: 'treatmentPlan',
          label: 'Treatment Plan',
          fieldType: 'textarea',
          required: true,
          section: 'plan',
          order: 1
        },
        {
          name: 'medications',
          label: 'Medications',
          fieldType: 'textarea',
          section: 'plan',
          order: 2
        },
        {
          name: 'followUpInstructions',
          label: 'Follow-up Instructions',
          fieldType: 'textarea',
          section: 'plan',
          order: 3
        }
      ]
    },
    {
      name: 'Progress Note',
      description: 'Standard progress note for follow-up visits',
      templateType: 'Progress',
      specialty: 'General Practice',
      isActive: true,
      isDefault: true,
      createdBy: userId,
      sections: [
        { name: 'progress', label: 'Progress', order: 1 },
        { name: 'plan', label: 'Plan', order: 2 }
      ],
      fields: [
        {
          name: 'progressSummary',
          label: 'Progress Summary',
          fieldType: 'textarea',
          required: true,
          section: 'progress',
          order: 1
        },
        {
          name: 'currentStatus',
          label: 'Current Status',
          fieldType: 'select',
          required: true,
          section: 'progress',
          order: 2,
          options: [
            { label: 'Improving', value: 'improving' },
            { label: 'Stable', value: 'stable' },
            { label: 'Worsening', value: 'worsening' },
            { label: 'Resolved', value: 'resolved' }
          ]
        },
        {
          name: 'patientResponse',
          label: 'Patient Response to Treatment',
          fieldType: 'textarea',
          section: 'progress',
          order: 3
        },
        {
          name: 'adjustments',
          label: 'Adjustments to Treatment Plan',
          fieldType: 'textarea',
          section: 'plan',
          order: 1
        },
        {
          name: 'nextSteps',
          label: 'Next Steps',
          fieldType: 'textarea',
          required: true,
          section: 'plan',
          order: 2
        }
      ]
    }
  ];

  // Check if default templates already exist
  for (const template of defaults) {
    const exists = await this.findOne({
      name: template.name,
      templateType: template.templateType,
      isDefault: true
    });

    if (!exists) {
      await this.create(template);
    }
  }
};

const NoteTemplate = mongoose.model('NoteTemplate', noteTemplateSchema);

module.exports = NoteTemplate;
/**
 * Healthcare Management Application
 * Medical Record Model
 * 
 * Schema for patient medical records with HIPAA compliance considerations
 * Includes comprehensive tracking of patient medical history, tests, and treatments
 */

const mongoose = require('mongoose');
const { createSchema } = require('./baseSchema');

/**
 * Types of medical records
 */
const RECORD_TYPES = {
  PROGRESS_NOTE: 'progress_note',
  LAB_RESULT: 'lab_result',
  IMAGING: 'imaging',
  MEDICATION: 'medication',
  PROCEDURE: 'procedure',
  VITAL_SIGNS: 'vital_signs',
  ALLERGY: 'allergy',
  IMMUNIZATION: 'immunization',
  REFERRAL: 'referral',
  DISCHARGE_SUMMARY: 'discharge_summary',
  CONSULTATION: 'consultation',
  SURGICAL_REPORT: 'surgical_report'
};

/**
 * Medical record schema definition
 */
const medicalRecordSchema = createSchema({
  // Patient reference
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient reference is required'],
    index: true
  },
  
  // Record type
  recordType: {
    type: String,
    required: [true, 'Record type is required'],
    enum: {
      values: Object.values(RECORD_TYPES),
      message: 'Invalid record type'
    },
    index: true
  },
  
  // Visit/encounter reference
  visit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    index: true
  },
  
  // Record date
  recordDate: {
    type: Date,
    required: [true, 'Record date is required'],
    default: Date.now,
    index: true
  },
  
  // Provider who created the record
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Provider is required']
  },
  
  // Facility where record was created
  facility: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Facility'
  },
  
  // Chief complaint and diagnosis
  chiefComplaint: String,
  
  diagnosis: [{
    code: String,  // ICD-10 code
    description: String,
    diagnosisDate: Date,
    diagnosedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    status: {
      type: String,
      enum: ['active', 'resolved', 'recurring']
    },
    notes: String
  }],
  
  // Vital signs
  vitalSigns: {
    temperature: {
      value: Number,
      unit: {
        type: String,
        default: 'F',
        enum: ['F', 'C']
      }
    },
    bloodPressure: {
      systolic: Number,
      diastolic: Number,
      position: {
        type: String,
        enum: ['sitting', 'standing', 'lying']
      }
    },
    heartRate: Number,
    respiratoryRate: Number,
    oxygenSaturation: Number,
    height: {
      value: Number,
      unit: {
        type: String,
        default: 'cm',
        enum: ['cm', 'in']
      }
    },
    weight: {
      value: Number,
      unit: {
        type: String,
        default: 'kg',
        enum: ['kg', 'lb']
      }
    },
    bmi: Number,
    pain: {
      score: {
        type: Number,
        min: 0,
        max: 10
      },
      location: String
    }
  },
  
  // Clinical notes - narrative description of patient encounter
  clinicalNotes: {
    type: String,
    required: function() {
      return this.recordType === RECORD_TYPES.PROGRESS_NOTE || 
             this.recordType === RECORD_TYPES.CONSULTATION;
    }
  },
  
  // Subjective, Objective, Assessment, Plan format
  soapNote: {
    subjective: String,
    objective: String,
    assessment: String,
    plan: String
  },
  
  // Treatments and procedures
  procedures: [{
    procedureCode: String, // CPT code
    procedureName: String,
    procedureDate: Date,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    notes: String,
    outcome: String,
    complications: String
  }],
  
  // Medications
  medications: [{
    name: {
      type: String,
      required: true
    },
    dosage: String,
    route: {
      type: String,
      enum: ['oral', 'intravenous', 'intramuscular', 'subcutaneous', 'topical', 'inhaled', 'other']
    },
    frequency: String,
    startDate: Date,
    endDate: Date,
    prescribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    pharmacy: String,
    prescriptionNumber: String,
    instructions: String,
    reason: String,
    status: {
      type: String,
      enum: ['active', 'discontinued', 'completed'],
      default: 'active'
    }
  }],
  
  // Laboratory test results
  labResults: [{
    testName: String,
    testCode: String,
    collectedDate: Date,
    receivedDate: Date,
    resultDate: Date,
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    performedBy: String, // Lab name or technician
    result: String,
    units: String,
    referenceRange: String,
    abnormalFlag: {
      type: String,
      enum: ['normal', 'low', 'high', 'critical']
    },
    notes: String
  }],
  
  // Imaging studies
  imagingResults: [{
    studyType: {
      type: String,
      enum: ['X-ray', 'MRI', 'CT', 'Ultrasound', 'PET', 'Mammography', 'Other']
    },
    bodyPart: String,
    orderedDate: Date,
    performedDate: Date,
    orderedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    findings: String,
    impression: String,
    imageUrl: String,
    recommendedFollowUp: String
  }],
  
  // Allergies and adverse reactions
  allergies: [{
    allergen: String,
    allergenType: {
      type: String,
      enum: ['drug', 'food', 'environmental', 'other']
    },
    reaction: String,
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe', 'life-threatening']
    },
    onsetDate: Date,
    status: {
      type: String,
      enum: ['active', 'inactive']
    },
    notes: String
  }],
  
  // Immunizations
  immunizations: [{
    vaccine: String,
    vaccinationDate: Date,
    administeredBy: String,
    manufacturer: String,
    lotNumber: String,
    expirationDate: Date,
    site: {
      type: String,
      enum: ['left arm', 'right arm', 'left thigh', 'right thigh', 'other']
    },
    dose: String,
    route: {
      type: String,
      enum: ['intramuscular', 'subcutaneous', 'intradermal', 'oral', 'other']
    },
    notes: String
  }],
  
  // Attachments and documents
  attachments: [{
    name: String,
    fileType: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    description: String,
    tags: [String]
  }],
  
  // Instructions for patient
  patientInstructions: String,
  
  // Follow-up recommendations
  followUp: {
    recommended: Boolean,
    timeframe: String, // e.g., "2 weeks", "3 months"
    withProvider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    reason: String,
    notes: String
  },
  
  // Referrals to other providers
  referrals: [{
    referredTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor'
    },
    specialty: String,
    reason: String,
    urgency: {
      type: String,
      enum: ['routine', 'urgent', 'emergency']
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'completed', 'declined']
    },
    notes: String
  }],
  
  // HIPAA audit fields
  accessLogs: [{
    accessedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    accessedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    ipAddress: String,
    action: {
      type: String,
      enum: ['viewed', 'created', 'updated', 'exported', 'printed']
    }
  }],

  // Electronic signature of provider
  signature: {
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    signedAt: Date,
    signatureData: String
  },
  
  // Security and privacy
  privacyLevel: {
    type: String,
    enum: ['normal', 'sensitive', 'restricted'],
    default: 'normal'
  },
  
  // Status of medical record
  status: {
    type: String,
    enum: ['draft', 'final', 'amended', 'addendum'],
    default: 'draft'
  }
},
// Additional schema options
{
  // Special indexing for HIPAA audit capability
  timestamps: {
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  }
});

// Middleware to automatically add HIPAA access log entry
medicalRecordSchema.methods.logAccess = async function(userId, action, reason, ipAddress) {
  this.accessLogs.push({
    accessedBy: userId,
    accessedAt: new Date(),
    reason: reason || 'Patient care',
    ipAddress: ipAddress,
    action: action || 'viewed'
  });
  
  await this.save();
};

// Middleware to sign and finalize a record
medicalRecordSchema.methods.signAndFinalize = async function(userId) {
  if (this.status === 'final') {
    throw new Error('Record is already finalized');
  }
  
  this.status = 'final';
  this.signature = {
    signedBy: userId,
    signedAt: new Date()
  };
  
  return await this.save();
};

// Method to create an amendment
medicalRecordSchema.methods.createAmendment = async function(amendmentText, userId) {
  if (this.status !== 'final') {
    throw new Error('Only finalized records can be amended');
  }
  
  // Create a new record that references this one
  const MedicalRecord = this.constructor;
  const amendment = new MedicalRecord({
    patient: this.patient,
    recordType: this.recordType,
    visit: this.visit,
    recordDate: new Date(),
    provider: userId,
    facility: this.facility,
    clinicalNotes: amendmentText,
    status: 'amendment',
    // Reference to the original record could be added here
  });
  
  return await amendment.save();
};

// Indexes for performance
medicalRecordSchema.index({ patient: 1, recordDate: -1 });
medicalRecordSchema.index({ provider: 1, recordDate: -1 });
medicalRecordSchema.index({ recordType: 1 });
medicalRecordSchema.index({ visit: 1 });
medicalRecordSchema.index({ 'diagnosis.code': 1 });
medicalRecordSchema.index({ 'labResults.testCode': 1 });
medicalRecordSchema.index({ 'medications.name': 1 });
medicalRecordSchema.index({ 'accessLogs.accessedAt': 1 });

// Create the model
const MedicalRecord = mongoose.model('MedicalRecord', medicalRecordSchema);

module.exports = {
  MedicalRecord,
  RECORD_TYPES
};
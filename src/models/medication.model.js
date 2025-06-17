const mongoose = require('mongoose');
const { Schema } = mongoose;

const interactionSchema = new Schema({
  interactsWith: {
    type: Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe', 'contraindicated'],
    required: true
  },
  description: {
    type: String,
    required: true
  }
});

const sideEffectSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  frequency: {
    type: String,
    enum: ['rare', 'uncommon', 'common', 'very common'],
    default: 'uncommon'
  },
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe'],
    default: 'moderate'
  }
});

const dosageFormSchema = new Schema({
  form: {
    type: String,
    enum: ['tablet', 'capsule', 'liquid', 'injection', 'cream', 'ointment', 'patch', 'inhaler', 'other'],
    required: true
  },
  strength: {
    type: String,
    required: true
  },
  unit: {
    type: String,
    required: true
  }
});

const medicationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    brandNames: [{
      type: String,
      trim: true
    }],
    ndc: { // National Drug Code
      type: String,
      unique: true,
      required: true,
      trim: true
    },
    rxcui: { // RxNorm Concept Unique Identifier
      type: String,
      trim: true
    },
    medicationType: {
      type: String,
      enum: ['prescription', 'otc'],
      default: 'prescription'
    },
    classification: {
      type: String,
      required: true,
      trim: true
    },
    controlledSubstanceClass: {
      type: String,
      enum: ['none', 'I', 'II', 'III', 'IV', 'V'],
      default: 'none'
    },
    dosageForms: [dosageFormSchema],
    standardDosages: [{
      ageGroup: String,
      weight: String,
      dosage: String,
      frequency: String,
      maxDailyDose: String
    }],
    interactions: [interactionSchema],
    sideEffects: [sideEffectSchema],
    contraindications: [{
      type: String,
      trim: true
    }],
    warnings: [{
      type: String,
      trim: true
    }],
    manufacturer: {
      type: String,
      trim: true
    },
    pregnancyCategory: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'X', 'N'],
      default: 'N' // Not classified
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes for faster query performance
medicationSchema.index({ name: 'text', genericName: 'text' });
medicationSchema.index({ classification: 1 });
medicationSchema.index({ controlledSubstanceClass: 1 });

const Medication = mongoose.model('Medication', medicationSchema);

module.exports = Medication;
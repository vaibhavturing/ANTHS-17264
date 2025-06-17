const mongoose = require('mongoose');
const { Schema } = mongoose;

const allergySchema = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    allergen: {
      type: String,
      required: true,
      trim: true
    },
    allergenType: {
      type: String,
      enum: ['medication', 'food', 'environmental'],
      required: true
    },
    // For medication allergies, store the reference
    medicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Medication'
    },
    // For medications, we can also link to the class or ingredient
    allergenClass: {
      type: String,
      trim: true
    },
    severity: {
      type: String,
      enum: ['mild', 'moderate', 'severe'],
      required: true
    },
    reaction: {
      type: String,
      required: true,
      trim: true
    },
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    },
    notes: {
      type: String,
      trim: true
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Compound index for patient and allergen for faster lookups
allergySchema.index({ patient: 1, allergen: 1 });
// Index for allergen type
allergySchema.index({ allergenType: 1 });
// Index for medication ID references
allergySchema.index({ medicationId: 1 });

const Allergy = mongoose.model('Allergy', allergySchema);

module.exports = Allergy;
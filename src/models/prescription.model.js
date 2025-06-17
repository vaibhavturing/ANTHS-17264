const mongoose = require('mongoose');
const { Schema } = mongoose;

const medicationPrescribedSchema = new Schema({
  medication: {
    type: Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  dosage: {
    amount: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      required: true
    }
  },
  route: {
    type: String,
    enum: ['oral', 'topical', 'injection', 'inhaled', 'rectal', 'vaginal', 'ophthalmic', 'otic', 'nasal', 'other'],
    required: true
  },
  frequency: {
    type: String,
    required: true
  },
  duration: {
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months', 'as needed'],
      required: true
    }
  },
  quantity: {
    type: Number,
    required: true
  },
  refills: {
    type: Number,
    required: true,
    default: 0
  },
  dispenseAsWritten: {
    type: Boolean,
    default: false
  },
  instructions: {
    type: String,
    required: true
  },
  reasonForPrescribing: {
    type: String
  }
});

const interactionWarningSchema = new Schema({
  medicationIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Medication'
  }],
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe', 'contraindicated'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  overrideReason: {
    type: String
  },
  overriddenAt: {
    type: Date
  },
  overriddenBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

const allergyWarningSchema = new Schema({
  allergyId: {
    type: Schema.Types.ObjectId,
    ref: 'Allergy'
  },
  medicationId: {
    type: Schema.Types.ObjectId,
    ref: 'Medication'
  },
  severity: {
    type: String,
    enum: ['mild', 'moderate', 'severe', 'contraindicated'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  overrideReason: {
    type: String
  },
  overriddenAt: {
    type: Date
  },
  overriddenBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
});

const prescriptionSchema = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    prescribedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', // Doctor
      required: true
    },
    visitId: {
      type: Schema.Types.ObjectId,
      ref: 'Visit'
    },
    medications: [medicationPrescribedSchema],
    pharmacy: {
      type: Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true
    },
    interactionWarnings: [interactionWarningSchema],
    allergyWarnings: [allergyWarningSchema],
    status: {
      type: String,
      enum: ['draft', 'pending', 'active', 'completed', 'cancelled', 'rejected'],
      default: 'draft'
    },
    statusHistory: [{
      status: {
        type: String,
        enum: ['draft', 'pending', 'active', 'completed', 'cancelled', 'rejected'],
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      notes: String
    }],
    prescriptionDate: {
      type: Date,
      default: Date.now
    },
    expirationDate: {
      type: Date,
      required: true
    },
    digitalSignature: {
      data: String,
      timestamp: Date
    },
    transmissionMethod: {
      type: String,
      enum: ['electronic', 'fax', 'print', 'phone'],
      default: 'electronic'
    },
    transmissionDetails: {
      sentAt: Date,
      receivedAt: Date,
      confirmationCode: String,
      transmissionErrors: [String]
    },
    notes: {
      type: String
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Indexes for faster query performance
prescriptionSchema.index({ patient: 1 });
prescriptionSchema.index({ prescribedBy: 1 });
prescriptionSchema.index({ pharmacy: 1 });
prescriptionSchema.index({ status: 1 });
prescriptionSchema.index({ prescriptionDate: 1 });

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;
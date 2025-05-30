/**
 * Healthcare Management Application
 * Patient Model
 * 
 * Schema for patient records with comprehensive medical information
 * Designed with HIPAA compliance considerations
 */

const mongoose = require('mongoose');
const { createSchema } = require('./baseSchema');

/**
 * Blood type enumeration
 */
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * Patient schema definition
 * Contains PHI (Protected Health Information) that must be handled according to HIPAA
 */
const patientSchema = createSchema({
  // Reference to user model for authentication and basic info
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  
  // Medical Record Number (unique identifier in the healthcare system)
  mrn: {
    type: String,
    required: [true, 'Medical Record Number is required'],
    unique: true,
    trim: true,
    index: true
  },
  
  // Demographic data
  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other', 'prefer-not-to-say'],
      message: 'Gender must be male, female, other, or prefer-not-to-say'
    },
    required: [true, 'Gender is required']
  },
  
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(dob) {
        return dob < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  
  ssn: {
    type: String,
    match: [
      /^\d{3}-\d{2}-\d{4}$/,
      'Please enter a valid SSN in format XXX-XX-XXXX'
    ],
    select: false  // Protected field, only explicitly requested
  },
  
  // Contact information
  contactDetails: {
    primaryPhone: {
      type: String,
      required: [true, 'Primary phone number is required'],
      match: [
        /^\+?[1-9]\d{9,14}$/,
        'Please provide a valid phone number'
      ]
    },
    secondaryPhone: String,
    email: {
      type: String,
      match: [
        /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
        'Please provide a valid email address'
      ]
    },
    preferredContactMethod: {
      type: String,
      enum: ['phone', 'email', 'mail'],
      default: 'phone'
    }
  },
  
  // Address information
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required'],
      match: [
        /^\d{5}(-\d{4})?$/,
        'Please provide a valid ZIP code'
      ]
    },
    country: {
      type: String,
      default: 'United States'
    }
  },
  
  // Emergency contact information
  emergencyContact: {
    name: {
      type: String,
      required: [true, 'Emergency contact name is required']
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required']
    },
    phone: {
      type: String,
      required: [true, 'Emergency contact phone is required'],
      match: [
        /^\+?[1-9]\d{9,14}$/,
        'Please provide a valid phone number'
      ]
    },
    address: String
  },
  
  // Insurance information
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    policyHolder: {
      name: String,
      relationship: String,
      dateOfBirth: Date
    },
    coverageStartDate: Date,
    coverageEndDate: Date
  },
  
  // Medical information
  medicalInformation: {
    bloodType: {
      type: String,
      enum: {
        values: BLOOD_TYPES,
        message: `Blood type must be one of: ${BLOOD_TYPES.join(', ')}`
      }
    },
    height: {  // in centimeters
      type: Number,
      min: [30, 'Height must be at least 30 cm'],
      max: [250, 'Height cannot exceed 250 cm']
    },
    weight: {  // in kilograms
      type: Number,
      min: [1, 'Weight must be at least 1 kg'],
      max: [500, 'Weight cannot exceed 500 kg']
    },
    allergies: [{
      allergen: String,
      severity: {
        type: String,
        enum: ['mild', 'moderate', 'severe', 'life-threatening']
      },
      reaction: String,
      identified: Date
    }],
    medications: [{
      name: {
        type: String,
        required: true
      },
      dosage: String,
      frequency: String,
      startDate: Date,
      endDate: Date,
      prescribedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor'
      }
    }],
    chronicConditions: [String],
    familyMedicalHistory: {
      type: String,
      // Using select:false for HIPAA-sensitive data
      select: false
    }
  },
  
  // Primary care physician
  primaryCarePhysician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  
  // Patient status
  status: {
    type: String,
    enum: ['active', 'inactive', 'deceased'],
    default: 'active'
  },
  
  // Administrative information
  administrativeInformation: {
    registrationDate: {
      type: Date,
      default: Date.now
    },
    lastVisit: Date,
    consentForms: [{
      formType: String,
      signedDate: Date,
      expiryDate: Date,
      formData: {
        type: Object,
        select: false  // Protected field, only explicitly requested
      }
    }]
  },
  
  // HIPAA acknowledgement
  hipaaAcknowledgement: {
    acknowledged: {
      type: Boolean,
      default: false
    },
    acknowledgedDate: Date,
    lastUpdated: Date
  },
  
  // Patient preferences
  preferences: {
    language: {
      type: String,
      default: 'English'
    },
    communicationPreferences: {
      appointmentReminders: {
        type: Boolean,
        default: true
      },
      method: {
        type: String,
        enum: ['email', 'phone', 'sms', 'mail'],
        default: 'sms'
      }
    }
  },
  
  notes: {
    type: String,
    // Using select:false for potentially sensitive notes
    select: false
  }
}, {
  // Enable discriminator key for patient-specific types
  discriminatorKey: 'patientType'
});

// Virtual property for age calculation
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Indexes for performance and lookups
patientSchema.index({ userId: 1 }, { unique: true });
patientSchema.index({ mrn: 1 }, { unique: true });
patientSchema.index({ 'insurance.policyNumber': 1 });
patientSchema.index({ primaryCarePhysician: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ 'contactDetails.primaryPhone': 1 });

// Create timestamps for auditing
patientSchema.set('timestamps', true);

// Add HIPAA audit trail
patientSchema.pre('save', function(next) {
  // This could be expanded to include a more detailed audit trail
  this.lastUpdated = new Date();
  next();
});

// Create the model
const Patient = mongoose.model('Patient', patientSchema);

module.exports = {
  Patient,
  BLOOD_TYPES
};
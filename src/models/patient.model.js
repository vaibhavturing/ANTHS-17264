const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');

const patientSchema = new mongoose.Schema({
  // Link to user account for authentication
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Demographics
  dateOfBirth: {
    type: Date,
    required: true,
    validate: {
      validator: function(dob) {
        return dob <= new Date();
      },
      message: 'Date of birth cannot be in the future'
    }
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    required: true
  },
  ssn: {
    type: String,
    required: true,
    unique: true,
    maxlength: 11,
    minlength: 9,
    // Store encrypted
    select: false
  },
  maritalStatus: {
    type: String,
    enum: ['Single', 'Married', 'Divorced', 'Widowed', 'Other'],
    default: 'Single'
  },
  
  // Contact information
  address: {
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'United States'
    }
  },
  phoneNumber: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  alternatePhoneNumber: {
    type: String,
    validate: {
      validator: function(v) {
        // Allow empty string
        if (!v) return true;
        return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  preferredContactMethod: {
    type: String,
    enum: ['Phone', 'Email', 'Mail'],
    default: 'Phone'
  },
  
  // Medical Information
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
    default: 'Unknown'
  },
  allergies: [{
    allergen: String,
    severity: {
      type: String,
      enum: ['Mild', 'Moderate', 'Severe', 'Life-threatening']
    },
    reaction: String
  }],
  currentMedications: [{
    name: String,
    dosage: String,
    frequency: String,
    startDate: Date,
    endDate: Date
  }],
  chronicConditions: [String],
  familyMedicalHistory: [{
    condition: String,
    relationship: String
  }],
  pastSurgeries: [{
    procedure: String,
    date: Date,
    hospital: String,
    surgeon: String,
    notes: String
  }],
  primaryCarePhysician: {
    name: String,
    contact: String,
    facility: String
  },
  
  // Insurance Information
  insurance: {
    provider: {
      type: String,
      required: true
    },
    policyNumber: {
      type: String,
      required: true,
      select: false
    },
    groupNumber: {
      type: String,
      select: false
    },
    policyHolder: {
      type: String,
      default: 'Self'
    },
    relationshipToPatient: {
      type: String,
      enum: ['Self', 'Spouse', 'Parent', 'Other'],
      default: 'Self'
    },
    expirationDate: Date
  },
  secondaryInsurance: {
    provider: String,
    policyNumber: {
      type: String,
      select: false
    },
    groupNumber: {
      type: String,
      select: false
    },
    policyHolder: String,
    relationshipToPatient: {
      type: String,
      enum: ['Self', 'Spouse', 'Parent', 'Other']
    },
    expirationDate: Date
  },
  
  // Emergency Contacts
  emergencyContacts: [{
    name: {
      type: String,
      required: true
    },
    relationship: {
      type: String,
      required: true
    },
    phoneNumber: {
      type: String,
      required: true
    },
    address: String,
    isAuthorizedToDiscussHealth: {
      type: Boolean,
      default: false
    }
  }],
  
  // Consent and Documentation
  consents: [{
    type: {
      type: String,
      enum: ['Treatment', 'HIPAA', 'Research', 'DataSharing', 'Telemedicine'],
      required: true
    },
    givenDate: {
      type: Date,
      default: Date.now
    },
    expirationDate: Date,
    documentReference: String,
    revoked: {
      type: Boolean,
      default: false
    },
    revokedDate: Date
  }],
  
  // Patient Portal Access
  portalActivated: {
    type: Boolean,
    default: false
  },
  activationDate: Date,
  lastPortalAccess: Date,
  
  // Registration Status
  registrationStatus: {
    type: String,
    enum: ['Incomplete', 'Pending', 'Approved', 'Rejected'],
    default: 'Incomplete'
  },
  registrationDate: {
    type: Date,
    default: Date.now
  },
  registrationCompletedDate: Date,
  missingDocuments: [String],
  registrationNotes: String,
  
}, baseSchema.baseOptions);

// Pre-save middleware to encrypt SSN
patientSchema.pre('save', async function(next) {
  // Only encrypt SSN if it's modified or new
  if (!this.isModified('ssn')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.ssn = await bcrypt.hash(this.ssn, salt);
    next();
  } catch (error) {
    logger.error('SSN encryption failed', { error: error.message });
    next(new Error('Patient information processing failed'));
  }
});

// Pre-save middleware to encrypt insurance information
patientSchema.pre('save', async function(next) {
  try {
    // Only encrypt policy numbers if modified
    if (this.isModified('insurance.policyNumber')) {
      const salt = await bcrypt.genSalt(10);
      this.insurance.policyNumber = await bcrypt.hash(this.insurance.policyNumber, salt);
    }
    
    if (this.secondaryInsurance && this.isModified('secondaryInsurance.policyNumber')) {
      const salt = await bcrypt.genSalt(10);
      this.secondaryInsurance.policyNumber = await bcrypt.hash(this.secondaryInsurance.policyNumber, salt);
    }
    next();
  } catch (error) {
    logger.error('Insurance information encryption failed', { error: error.message });
    next(new Error('Patient information processing failed'));
  }
});

// Method to validate an SSN against the stored encrypted version
patientSchema.methods.validateSSN = async function(candidateSSN) {
  try {
    // We need to explicitly select the SSN field since it's not included by default
    const patient = await mongoose.model('Patient').findById(this._id).select('+ssn');
    return await bcrypt.compare(candidateSSN, patient.ssn);
  } catch (error) {
    logger.error('SSN validation failed', { error: error.message });
    throw new Error('Patient information verification failed');
  }
};

// Virtual for patient's full name
patientSchema.virtual('fullName').get(function() {
  // Relies on the populated user field
  if (!this.populated('user')) {
    return "Unknown";
  }
  return `${this.user.firstName} ${this.user.lastName}`;
});

// Virtual for patient's age
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Index for efficient queries
patientSchema.index({ 'user': 1 });
patientSchema.index({ 'registrationStatus': 1 });
patientSchema.index({ 'insurance.provider': 1 });

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
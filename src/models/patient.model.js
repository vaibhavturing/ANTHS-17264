const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const baseSchema = require('./baseSchema');
const logger = require('../utils/logger');
const crypto = require('crypto');

// CHANGE: Enhanced patient schema with comprehensive medical profile fields
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
  ethnicity: {
    type: String,
    enum: ['Hispanic or Latino', 'Not Hispanic or Latino', 'Decline to specify'],
  },
  race: {
    type: String,
    enum: [
      'American Indian or Alaska Native',
      'Asian',
      'Black or African American',
      'Native Hawaiian or Other Pacific Islander',
      'White',
      'More than one race',
      'Decline to specify'
    ],
  },
  preferredLanguage: {
    type: String,
    default: 'English'
  },
  needsInterpreter: {
    type: Boolean,
    default: false
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
  
  // CHANGE: Enhanced Medical Information with structured data
  // Vital Signs - Latest recorded values
  vitalSigns: {
    height: { 
      value: Number,
      unit: { type: String, enum: ['cm', 'in'], default: 'cm' },
      recordedAt: Date
    },
    weight: { 
      value: Number,
      unit: { type: String, enum: ['kg', 'lb'], default: 'kg' },
      recordedAt: Date
    },
    bmi: { 
      value: Number,
      recordedAt: Date
    },
    bloodPressure: { 
      systolic: Number,
      diastolic: Number,
      position: { type: String, enum: ['sitting', 'standing', 'lying'], default: 'sitting' },
      recordedAt: Date
    },
    temperature: { 
      value: Number,
      unit: { type: String, enum: ['C', 'F'], default: 'C' },
      recordedAt: Date
    },
    pulseRate: { 
      value: Number,
      regularity: { type: String, enum: ['regular', 'irregular'], default: 'regular' },
      recordedAt: Date
    },
    respirationRate: { 
      value: Number,
      recordedAt: Date
    },
    oxygenSaturation: { 
      value: Number,
      recordedAt: Date
    },
    painLevel: { 
      value: Number,
      scale: { type: String, default: '0-10' },
      location: String,
      recordedAt: Date
    }
  },
  
  // CHANGE: Enhanced Allergies with detailed reaction information
  allergies: [{
    allergen: { type: String, required: true },
    allergenType: { 
      type: String, 
      enum: ['Food', 'Medication', 'Environmental', 'Insect', 'Other'],
      default: 'Other'
    },
    reaction: String,
    severity: {
      type: String,
      enum: ['Mild', 'Moderate', 'Severe', 'Life-threatening'],
      required: true
    },
    diagnosedDate: Date,
    status: {
      type: String,
      enum: ['Active', 'Resolved', 'Inactive'],
      default: 'Active'
    },
    treatmentNotes: String,
    reportedBy: {
      type: String,
      enum: ['Patient', 'Provider', 'Family', 'Other'],
      default: 'Patient'
    },
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  }],
  
  // CHANGE: Enhanced Medications with detailed tracking
  medications: [{
    name: { type: String, required: true },
    genericName: String,
    classification: String,
    dosage: { type: String, required: true },
    form: { 
      type: String, 
      enum: ['Tablet', 'Capsule', 'Liquid', 'Injection', 'Patch', 'Inhaler', 'Other']
    },
    frequency: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: Date,
    purpose: String,
    prescribedBy: {
      provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
      facility: String,
      date: Date
    },
    instructions: String,
    sideEffects: [String],
    adherence: {
      status: { 
        type: String,
        enum: ['Adherent', 'Partially Adherent', 'Non-adherent', 'Unknown'],
        default: 'Unknown'
      },
      notes: String
    },
    status: {
      type: String,
      enum: ['Active', 'Discontinued', 'Completed', 'On Hold'],
      default: 'Active'
    },
    refills: {
      allowed: Number,
      used: Number,
      lastRefillDate: Date,
      nextRefillDue: Date
    },
    pharmacy: {
      name: String,
      location: String,
      phone: String
    },
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  }],
  
  // CHANGE: Added immunizations section
  immunizations: [{
    name: { type: String, required: true },
    administeredDate: { type: Date, required: true },
    administratorName: String,
    manufacturer: String,
    lotNumber: String,
    expirationDate: Date,
    site: { 
      type: String,
      enum: ['Left Arm', 'Right Arm', 'Left Leg', 'Right Leg', 'Buttock', 'Oral', 'Intranasal', 'Other']
    },
    route: { 
      type: String,
      enum: ['Intramuscular', 'Subcutaneous', 'Intradermal', 'Oral', 'Intranasal', 'Other']
    },
    dose: String,
    series: {
      orderInSeries: Number,
      isSeriesComplete: Boolean
    },
    adverseReactions: [{
      reaction: String,
      severity: { 
        type: String,
        enum: ['Mild', 'Moderate', 'Severe', 'Life-threatening']
      },
      onsetDate: Date,
      resolutionDate: Date,
      notes: String
    }],
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  }],
  
  // CHANGE: Enhanced medical history with detailed tracking of conditions
  medicalHistory: [{
    condition: { type: String, required: true },
    conditionType: { 
      type: String,
      enum: ['Chronic', 'Acute', 'Surgical', 'Trauma', 'Congenital', 'Other'],
      default: 'Other'
    },
    diagnosisDate: Date,
    diagnosedBy: String,
    hospital: String,
    symptoms: [String],
    status: {
      type: String,
      enum: ['Active', 'Resolved', 'Managed', 'In Remission', 'Recurrent'],
      default: 'Active'
    },
    resolution: {
      date: Date,
      notes: String
    },
    treatmentNotes: String,
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  }],

  surgeries: [{
    procedure: { type: String, required: true },
    date: { type: Date, required: true },
    surgeon: String,
    facility: String,
    reason: String,
    outcome: {
      type: String,
      enum: ['Excellent', 'Good', 'Fair', 'Poor', 'Complications']
    },
    complications: [String],
    followUpCare: String,
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  }],
  
  // CHANGE: Enhanced family medical history with detailed relationships and conditions
  familyMedicalHistory: [{
    relationship: { 
      type: String, 
      enum: [
        'Mother', 'Father', 'Sister', 'Brother', 'Daughter', 'Son', 
        'Grandmother (Maternal)', 'Grandmother (Paternal)',
        'Grandfather (Maternal)', 'Grandfather (Paternal)',
        'Aunt (Maternal)', 'Aunt (Paternal)',
        'Uncle (Maternal)', 'Uncle (Paternal)',
        'Cousin', 'Other'
      ],
      required: true
    },
    condition: { type: String, required: true },
    diagnosisAge: Number,
    status: {
      type: String,
      enum: ['Living with condition', 'Deceased due to condition', 'Deceased unrelated to condition', 'Unknown'],
      default: 'Unknown'
    },
    notes: String,
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  }],
  
  // CHANGE: Added lifestyle information section
  lifestyle: {
    smokingStatus: { 
      type: String,
      enum: ['Never smoked', 'Former smoker', 'Current smoker', 'Unknown']
    },
    smokingDetails: {
      type: String,
      startYear: Number,
      quitYear: Number,
      packsPerDay: Number,
      packYears: Number
    },
    alcoholUse: { 
      type: String,
      enum: ['None', 'Occasional', 'Moderate', 'Heavy', 'Former', 'Unknown']
    },
    alcoholDetails: {
      frequency: String,
      amount: String,
      lastUse: Date,
      yearsOfUse: Number
    },
    recreationalDrugUse: { 
      type: String,
      enum: ['None', 'Current', 'Former', 'Unknown']
    },
    recreationalDrugDetails: {
      substances: [String],
      frequency: String,
      lastUse: Date,
      routeOfAdministration: [String]
    },
    exercise: { 
      type: String,
      enum: ['None', 'Occasional', 'Moderate', 'Regular', 'Intense']
    },
    exerciseDetails: {
      types: [String],
      frequencyPerWeek: Number,
      durationMinutes: Number
    },
    diet: { 
      type: String,
      enum: ['Regular', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Low-Sodium', 'Low-Fat', 'Diabetic', 'Other']
    },
    dietaryRestrictions: [String],
    occupation: String,
    occupationalHazards: [String],
    sleepPatterns: String,
    stressLevel: { 
      type: String,
      enum: ['Low', 'Moderate', 'High', 'Severe']
    },
    caffeineConsumption: { 
      type: String,
      enum: ['None', 'Light', 'Moderate', 'Heavy']
    },
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  },
  
  // CHANGE: Added mental health section
  mentalHealth: {
    conditions: [{
      diagnosis: String,
      diagnosedDate: Date,
      diagnosedBy: String,
      status: { 
        type: String,
        enum: ['Active', 'In Remission', 'Resolved']
      },
      treatments: [String]
    }],
    therapies: [{
      type: String,
      provider: String,
      startDate: Date,
      endDate: Date,
      frequency: String,
      notes: String
    }],
    hospitalizations: [{
      facility: String,
      admissionDate: Date,
      dischargeDate: Date,
      reason: String,
      treatmentProvided: String
    }],
    suicidalIdeation: {
      current: Boolean,
      past: Boolean,
      lastAssessmentDate: Date,
      riskLevel: {
        type: String,
        enum: ['None', 'Low', 'Moderate', 'High', 'Severe']
      },
      safetyPlan: Boolean
    },
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  },
  
  // CHANGE: Added preventive care section
  preventiveCare: {
    screenings: [{
      type: { 
        type: String,
        enum: [
          'Colonoscopy', 'Mammogram', 'Pap Smear', 'PSA Test', 'Bone Density', 
          'Cholesterol Screening', 'Depression Screening', 'Diabetes Screening',
          'HIV Test', 'TB Test', 'Other'
        ]
      },
      date: Date,
      results: String,
      dueDate: Date,
      recommendations: String,
      documentedBy: {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now }
      }
    }],
    healthMaintenance: [{
      type: {
        type: String,
        enum: [
          'Annual Physical', 'Eye Exam', 'Dental Exam', 'Flu Shot',
          'Tetanus Shot', 'Other'
        ]
      },
      date: Date,
      provider: String,
      findings: String,
      dueDate: Date,
      documentedBy: {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now }
      }
    }]
  },
  
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
    default: 'Unknown'
  },
  
  primaryCarePhysician: {
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    name: String,
    facility: String,
    phone: String,
    address: String,
    lastVisit: Date,
    nextAppointment: Date
  },
  
  specialists: [{
    specialty: String,
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    name: String,
    facility: String,
    phone: String,
    referralDate: Date,
    lastVisit: Date,
    nextAppointment: Date
  }],
  
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
    expirationDate: Date,
    // CHANGE: Added insurance card images
    cardFrontImage: {
      filename: String,
      contentType: String,
      // Store encrypted path to the file
      path: {
        type: String,
        select: false
      }
    },
    cardBackImage: {
      filename: String,
      contentType: String,
      // Store encrypted path to the file
      path: {
        type: String,
        select: false
      }
    }
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
    expirationDate: Date,
    cardFrontImage: {
      filename: String,
      contentType: String,
      path: {
        type: String,
        select: false
      }
    },
    cardBackImage: {
      filename: String,
      contentType: String,
      path: {
        type: String,
        select: false
      }
    }
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
  
  // CHANGE: Added advanced directives section
  advancedDirectives: {
    hasMedicalPowerOfAttorney: {
      status: Boolean,
      documentPath: String,
      agent: {
        name: String,
        relationship: String,
        phoneNumber: String,
        email: String
      }
    },
    hasLivingWill: {
      status: Boolean,
      documentPath: String
    },
    hasDoNotResuscitate: {
      status: Boolean,
      documentPath: String,
      scope: {
        type: String,
        enum: ['Full', 'Limited', 'Hospital Only']
      }
    },
    lastReviewed: Date,
    documentedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: Date
    }
  },
  
  // CHANGE: Added fields to track document uploads
  documents: [{
    type: {
      type: String,
      enum: ['Lab Result', 'Imaging', 'Consultation', 'Discharge Summary', 'Procedure Note', 'Other']
    },
    title: String,
    filename: String,
    contentType: String,
    // Store encrypted reference to document
    documentPath: {
      type: String,
      select: false
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    description: String,
    uploadedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    },
    source: {
      type: String,
      enum: ['Patient', 'Provider', 'External']
    }
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
  
  // CHANGE: Added profile completeness tracker
  profileCompleteness: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // CHANGE: Add version control metadata
  currentVersion: {
    type: Number,
    default: 1
  },
  lastUpdated: {
    date: {
      type: Date,
      default: Date.now
    },
    by: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: String
    },
    changes: [String]
  }
}, baseSchema.baseOptions);

// CHANGE: Added field encryption methods
// Pre-save middleware to encrypt sensitive information
patientSchema.pre('save', async function(next) {
  try {
    const encryptionFields = ['ssn', 'insurance.policyNumber'];
    
    // Only encrypt fields if they're modified
    for (const field of encryptionFields) {
      if (this.isModified(field)) {
        const fieldValue = field.includes('.') ? 
          this.get(field) : 
          this[field];
          
        if (fieldValue) {
          const salt = await bcrypt.genSalt(12);
          const hashedValue = await bcrypt.hash(fieldValue, salt);
          
          if (field.includes('.')) {
            // For nested fields
            const [parent, child] = field.split('.');
            this[parent][child] = hashedValue;
          } else {
            // For top-level fields
            this[field] = hashedValue;
          }
        }
      }
    }
    
    // Update the version number and last updated timestamp
    if (!this.isNew) {
      this.currentVersion += 1;
      this.lastUpdated.date = new Date();
    }
    
    // Calculate profile completeness
    this.calculateProfileCompleteness();
    
    next();
  } catch (error) {
    logger.error('Error in patient pre-save middleware', { error: error.message });
    next(error);
  }
});

// CHANGE: Added method to calculate profile completeness
patientSchema.methods.calculateProfileCompleteness = function() {
  // Create a weighted scoring system for profile completeness
  let score = 0;
  let totalWeight = 100;
  
  // Basic information (25%)
  const basicFields = ['user', 'dateOfBirth', 'gender', 'ssn', 'address', 'phoneNumber'];
  const basicWeight = 25;
  const basicFieldWeight = basicWeight / basicFields.length;
  
  basicFields.forEach(field => {
    if (this[field]) score += basicFieldWeight;
  });
  
  // Medical information (40%)
  let medicalScore = 0;
  if (this.bloodType && this.bloodType !== 'Unknown') medicalScore += 5;
  if (this.allergies && this.allergies.length > 0) medicalScore += 5;
  if (this.medications && this.medications.length > 0) medicalScore += 5;
  if (this.medicalHistory && this.medicalHistory.length > 0) medicalScore += 5;
  if (this.surgeries && this.surgeries.length > 0) medicalScore += 5;
  if (this.familyMedicalHistory && this.familyMedicalHistory.length > 0) medicalScore += 5;
  if (this.immunizations && this.immunizations.length > 0) medicalScore += 5;
  if (this.vitalSigns && this.vitalSigns.height && this.vitalSigns.weight) medicalScore += 5;
  score += medicalScore;
  
  // Insurance (15%)
  if (this.insurance && this.insurance.provider) score += 15;
  
  // Emergency contacts (10%)
  if (this.emergencyContacts && this.emergencyContacts.length > 0) score += 10;
  
  // Consents (10%)
  if (this.consents && this.consents.length > 0) score += 10;
  
  this.profileCompleteness = Math.min(Math.round(score), 100);
};

// CHANGE: Added method for encrypted field comparison
patientSchema.methods.compareEncryptedField = async function(field, candidateValue) {
  try {
    // For fields that aren't included by default
    const selectParam = {};
    selectParam[field] = 1;
    
    // Get the document with the specific field
    const doc = await mongoose.model('Patient').findById(this._id).select(selectParam);
    
    // Get the stored encrypted value
    let fieldValue;
    if (field.includes('.')) {
      // Handle nested fields
      const paths = field.split('.');
      fieldValue = paths.reduce((obj, path) => obj ? obj[path] : null, doc);
    } else {
      fieldValue = doc[field];
    }
    
    if (!fieldValue) return false;
    
    // Compare candidate value with stored encrypted value
    return await bcrypt.compare(candidateValue, fieldValue);
  } catch (error) {
    logger.error(`Error comparing encrypted field ${field}`, { error: error.message });
    throw new Error('Error verifying sensitive information');
  }
};

// CHANGE: Create virtuals for calculated values
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

// Virtual for full name through user reference
patientSchema.virtual('fullName').get(function() {
  if (this.user && this.populated('user')) {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
  return 'Unknown';
});

// CHANGE: Method to access fields based on role permissions
patientSchema.methods.getFieldsVisibleTo = function(role) {
  // This is a simple implementation - in a real app, this would use a permission framework
  const visibleFields = { ...this.toObject() };
  
  // Remove encrypted/sensitive fields for all roles
  delete visibleFields.ssn;
  
  if (role === 'admin' || role === 'doctor') {
    // Admins and doctors can see everything except encrypted fields
    return visibleFields;
  }
  
  if (role === 'nurse') {
    // Nurses can see most medical information but not all details
    const restrictedFields = [
      'insurance.policyNumber',
      'insurance.groupNumber',
      'secondaryInsurance.policyNumber',
      'secondaryInsurance.groupNumber',
      'mentalHealth.suicidalIdeation',
      'lifestyle.recreationalDrugDetails',
      'advancedDirectives'
    ];
    
    // Remove restricted fields
    restrictedFields.forEach(field => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        if (visibleFields[parent]) {
          delete visibleFields[parent][child];
        }
      } else {
        delete visibleFields[field];
      }
    });
    
    return visibleFields;
  }
  
  if (role === 'receptionist') {
    // Receptionists only need basic demographics and insurance
    const allowedTopLevelFields = [
      '_id', 'user', 'dateOfBirth', 'gender', 'address', 'phoneNumber',
      'alternatePhoneNumber', 'preferredContactMethod', 'emergencyContacts',
      'insurance', 'registrationStatus', 'registrationDate', 'profileCompleteness'
    ];
    
    // Create a new object with only allowed fields
    const filteredFields = {};
    allowedTopLevelFields.forEach(field => {
      if (visibleFields[field] !== undefined) {
        filteredFields[field] = visibleFields[field];
      }
    });
    
    // Remove sensitive fields from insurance
    if (filteredFields.insurance) {
      delete filteredFields.insurance.policyNumber;
      delete filteredFields.insurance.groupNumber;
    }
    
    return filteredFields;
  }
  
  // For patient role, return public information
  return {
    _id: visibleFields._id,
    dateOfBirth: visibleFields.dateOfBirth,
    gender: visibleFields.gender,
    address: visibleFields.address,
    phoneNumber: visibleFields.phoneNumber,
    alternatePhoneNumber: visibleFields.alternatePhoneNumber,
    preferredContactMethod: visibleFields.preferredContactMethod,
    bloodType: visibleFields.bloodType,
    allergies: visibleFields.allergies,
    medications: visibleFields.medications,
    emergencyContacts: visibleFields.emergencyContacts,
    consents: visibleFields.consents,
    registrationStatus: visibleFields.registrationStatus,
    primaryCarePhysician: visibleFields.primaryCarePhysician,
    profileCompleteness: visibleFields.profileCompleteness
  };
};

// Indexes for efficient queries
patientSchema.index({ 'user': 1 });
patientSchema.index({ 'registrationStatus': 1 });
patientSchema.index({ 'insurance.provider': 1 });
patientSchema.index({ 'registrationDate': 1 });
patientSchema.index({ 'lastUpdated.date': -1 });
patientSchema.index({ 'dateOfBirth': 1 });
patientSchema.index({ 'profileCompleteness': 1 });

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
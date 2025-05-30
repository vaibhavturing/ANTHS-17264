/**
 * Healthcare Management Application
 * Doctor Model
 * 
 * Schema for medical practitioners including doctors, specialists, and surgeons
 * Includes professional qualifications and specializations
 */

const mongoose = require('mongoose');
const { createSchema } = require('./baseSchema');

/**
 * Common medical specialties
 */
const SPECIALTIES = [
  'Family Medicine',
  'Internal Medicine',
  'Pediatrics',
  'Obstetrics and Gynecology',
  'Surgery',
  'Psychiatry',
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Urology',
  'Radiology',
  'Anesthesiology',
  'Emergency Medicine',
  'Pathology',
  'Pulmonology',
  'Rheumatology',
  'Other'
];

/**
 * Doctor schema definition
 */
const doctorSchema = createSchema({
  // Reference to user model for authentication and basic info
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  
  // Doctor professional identification
  npiNumber: {
    type: String,
    required: [true, 'National Provider Identifier (NPI) is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid 10-digit NPI number!`
    }
  },
  
  licenseNumber: {
    type: String,
    required: [true, 'Medical license number is required'],
    unique: true
  },
  
  licenseState: {
    type: String,
    required: [true, 'License state is required']
  },
  
  // Professional details
  specialty: {
    type: String,
    required: [true, 'Specialty is required'],
    enum: {
      values: SPECIALTIES,
      message: `Specialty must be one of: ${SPECIALTIES.join(', ')}`
    }
  },
  
  subSpecialty: String,
  
  // Board certification information
  boardCertifications: [{
    certificationName: String,
    certificationBody: String,
    certificationYear: Number,
    expirationYear: Number,
    certificationNumber: String
  }],
  
  // Education background
  education: [{
    institution: String,
    degree: String,
    fieldOfStudy: String,
    startYear: Number,
    endYear: Number
  }],
  
  // Professional experience
  experience: [{
    organization: String,
    position: String,
    startDate: Date,
    endDate: Date,
    description: String
  }],
  
  // Practice information
  practiceDetails: {
    primaryLocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility'
    },
    department: String,
    officePhone: String,
    officeEmail: String,
    consultationFee: Number,
    acceptsNewPatients: {
      type: Boolean,
      default: true
    },
    insuranceAccepted: [String]
  },
  
  // Schedule and availability
  availability: {
    regularHours: [{
      day: {
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      startTime: String,  // Format: "HH:MM"
      endTime: String,    // Format: "HH:MM"
      lunchStart: String, // Format: "HH:MM"
      lunchEnd: String    // Format: "HH:MM"
    }],
    exceptions: [{
      date: Date,
      available: Boolean,
      reason: String,
      customHours: {
        startTime: String,
        endTime: String
      }
    }]
  },
  
  // Consultation duration in minutes
  defaultConsultationDuration: {
    type: Number,
    default: 30,
    min: [5, 'Consultation duration cannot be less than 5 minutes'],
    max: [240, 'Consultation duration cannot exceed 4 hours']
  },
  
  // Professional privileges
  privileges: [{
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility'
    },
    privilegeType: String,
    grantedDate: Date,
    expiryDate: Date,
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked', 'expired']
    }
  }],
  
  // Professional memberships
  professionalMemberships: [{
    organization: String,
    membershipNumber: String,
    startDate: Date,
    endDate: Date
  }],
  
  // Areas of expertise or clinical interests
  areasOfExpertise: [String],
  
  // Languages spoken
  languages: [String],
  
  // Average rating based on patient reviews
  rating: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  
  // Status information
  status: {
    type: String,
    enum: ['active', 'on-leave', 'inactive'],
    default: 'active'
  },
  
  // Bio for patient portal
  bio: {
    type: String,
    maxlength: [1000, 'Bio cannot exceed 1000 characters']
  },
  
  // Administrative information
  administrativeInfo: {
    onBoardingDate: Date,
    lastCredentialingDate: Date,
    nextCredentialingDueDate: Date,
    hipaaTrainingDate: Date,
    hipaaTrainingExpiryDate: Date,
    notes: {
      type: String,
      select: false  // Administrative notes are not returned by default
    }
  }
});

// Virtual field for full name
doctorSchema.virtual('fullName').get(function() {
  return this.firstName + ' ' + this.lastName;
});

// Virtual field for formatted credentials (e.g., "Dr. Smith, Cardiology")
doctorSchema.virtual('formattedCredentials').get(function() {
  return `Dr. ${this.lastName}, ${this.specialty}`;
});

// Indexes for performance
doctorSchema.index({ userId: 1 }, { unique: true });
doctorSchema.index({ npiNumber: 1 }, { unique: true });
doctorSchema.index({ licenseNumber: 1, licenseState: 1 }, { unique: true });
doctorSchema.index({ specialty: 1 });
doctorSchema.index({ status: 1 });

// Pre-hook to populate user info when needed
doctorSchema.pre(/^find/, function(next) {
  if (this._populateUser !== false) {
    this.populate({
      path: 'userId',
      select: 'firstName lastName email phoneNumber'
    });
  }
  next();
});

// Create the model
const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = {
  Doctor,
  SPECIALTIES
};
const Joi = require('joi');

/**
 * Validators for patient profile management
 */
const patientProfileValidators = {
  // Validate profile updates
  updateProfile: Joi.object({
    // Include the update reason
    updateReason: Joi.string().trim(),
    
    // Demographics
    gender: Joi.string().valid('Male', 'Female', 'Other', 'Prefer not to say'),
    maritalStatus: Joi.string().valid('Single', 'Married', 'Divorced', 'Widowed', 'Other'),
    ethnicity: Joi.string().valid('Hispanic or Latino', 'Not Hispanic or Latino', 'Decline to specify'),
    race: Joi.string().valid(
      'American Indian or Alaska Native',
      'Asian',
      'Black or African American',
      'Native Hawaiian or Other Pacific Islander',
      'White',
      'More than one race',
      'Decline to specify'
    ),
    preferredLanguage: Joi.string(),
    needsInterpreter: Joi.boolean(),
    
    // Contact Information
    address: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/),
      country: Joi.string()
    }),
    phoneNumber: Joi.string().pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/),
    alternatePhoneNumber: Joi.string().pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/).allow(''),
    preferredContactMethod: Joi.string().valid('Phone', 'Email', 'Mail'),
    
    // Primary Care Provider
    primaryCarePhysician: Joi.object({
      provider: Joi.string(),
      name: Joi.string(),
      facility: Joi.string(),
      phone: Joi.string(),
      address: Joi.string(),
      lastVisit: Joi.date(),
      nextAppointment: Joi.date()
    }),
    
    // Emergency Contacts
    emergencyContacts: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        relationship: Joi.string().required(),
        phoneNumber: Joi.string().required(),
        address: Joi.string().allow(''),
        isAuthorizedToDiscussHealth: Joi.boolean().default(false)
      })
    )
  }).min(1), // At least one field must be provided
  
  // Validate vital signs recording
  recordVitalSigns: Joi.object({
    height: Joi.object({
      value: Joi.number().required(),
      unit: Joi.string().valid('cm', 'in').required()
    }),
    weight: Joi.object({
      value: Joi.number().required(),
      unit: Joi.string().valid('kg', 'lb').required()
    }),
    bloodPressure: Joi.object({
      systolic: Joi.number().required().min(50).max(250),
      diastolic: Joi.number().required().min(30).max(150),
      position: Joi.string().valid('sitting', 'standing', 'lying')
    }),
    temperature: Joi.object({
      value: Joi.number().required(),
      unit: Joi.string().valid('C', 'F').required()
    }),
    pulseRate: Joi.object({
      value: Joi.number().required(),
      regularity: Joi.string().valid('regular', 'irregular')
    }),
    respirationRate: Joi.object({
      value: Joi.number().required()
    }),
    oxygenSaturation: Joi.object({
      value: Joi.number().required().min(50).max(100)
    }),
    painLevel: Joi.object({
      value: Joi.number().required().min(0).max(10),
      location: Joi.string(),
      scale: Joi.string().default('0-10')
    })
  }).min(1), // At least one vital sign must be provided
  
  // Validate allergy addition
  addAllergy: Joi.object({
    allergen: Joi.string().required(),
    allergenType: Joi.string().valid('Food', 'Medication', 'Environmental', 'Insect', 'Other'),
    reaction: Joi.string(),
    severity: Joi.string().valid('Mild', 'Moderate', 'Severe', 'Life-threatening').required(),
    diagnosedDate: Joi.date(),
    status: Joi.string().valid('Active', 'Resolved', 'Inactive').default('Active'),
    treatmentNotes: Joi.string(),
    reportedBy: Joi.string().valid('Patient', 'Provider', 'Family', 'Other').default('Patient')
  }),
  
  // Validate allergy update
  updateAllergy: Joi.object({
    allergen: Joi.string(),
    allergenType: Joi.string().valid('Food', 'Medication', 'Environmental', 'Insect', 'Other'),
    reaction: Joi.string(),
    severity: Joi.string().valid('Mild', 'Moderate', 'Severe', 'Life-threatening'),
    diagnosedDate: Joi.date(),
    status: Joi.string().valid('Active', 'Resolved', 'Inactive'),
    treatmentNotes: Joi.string(),
    reportedBy: Joi.string().valid('Patient', 'Provider', 'Family', 'Other')
  }).min(1), // At least one field must be provided
  
  // Validate medication addition
  addMedication: Joi.object({
    name: Joi.string().required(),
    genericName: Joi.string(),
    classification: Joi.string(),
    dosage: Joi.string().required(),
    form: Joi.string().valid('Tablet', 'Capsule', 'Liquid', 'Injection', 'Patch', 'Inhaler', 'Other'),
    frequency: Joi.string().required(),
    startDate: Joi.date().required(),
    endDate: Joi.date(),
    purpose: Joi.string(),
    prescribedBy: Joi.object({
      provider: Joi.string(),
      facility: Joi.string(),
      date: Joi.date()
    }),
    instructions: Joi.string(),
    sideEffects: Joi.array().items(Joi.string()),
    adherence: Joi.object({
      status: Joi.string().valid('Adherent', 'Partially Adherent', 'Non-adherent', 'Unknown'),
      notes: Joi.string()
    }),
    status: Joi.string().valid('Active', 'Discontinued', 'Completed', 'On Hold').default('Active'),
    refills: Joi.object({
      allowed: Joi.number(),
      used: Joi.number(),
      lastRefillDate: Joi.date(),
      nextRefillDue: Joi.date()
    }),
    pharmacy: Joi.object({
      name: Joi.string(),
      location: Joi.string(),
      phone: Joi.string()
    })
  }),
  
  // Validate medical history addition
  addMedicalHistory: Joi.object({
    condition: Joi.string().required(),
    conditionType: Joi.string().valid('Chronic', 'Acute', 'Surgical', 'Trauma', 'Congenital', 'Other'),
    diagnosisDate: Joi.date(),
    diagnosedBy: Joi.string(),
    hospital: Joi.string(),
    symptoms: Joi.array().items(Joi.string()),
    status: Joi.string().valid('Active', 'Resolved', 'Managed', 'In Remission', 'Recurrent').default('Active'),
    resolution: Joi.object({
      date: Joi.date(),
      notes: Joi.string()
    }),
    treatmentNotes: Joi.string()
  }),
  
  // Validate family history addition
  addFamilyHistory: Joi.object({
    relationship: Joi.string().valid(
      'Mother', 'Father', 'Sister', 'Brother', 'Daughter', 'Son', 
      'Grandmother (Maternal)', 'Grandmother (Paternal)',
      'Grandfather (Maternal)', 'Grandfather (Paternal)',
      'Aunt (Maternal)', 'Aunt (Paternal)',
      'Uncle (Maternal)', 'Uncle (Paternal)',
      'Cousin', 'Other'
    ).required(),
    condition: Joi.string().required(),
    diagnosisAge: Joi.number().min(0).max(120),
    status: Joi.string().valid('Living with condition', 'Deceased due to condition', 'Deceased unrelated to condition', 'Unknown'),
    notes: Joi.string()
  }),
  
  // Validate lifestyle updates
  updateLifestyle: Joi.object({
    smokingStatus: Joi.string().valid('Never smoked', 'Former smoker', 'Current smoker', 'Unknown'),
    smokingDetails: Joi.object({
      type: Joi.string(),
      startYear: Joi.number().integer().min(1900).max(new Date().getFullYear()),
      quitYear: Joi.number().integer().min(1900).max(new Date().getFullYear()),
      packsPerDay: Joi.number(),
      packYears: Joi.number()
    }),
    alcoholUse: Joi.string().valid('None', 'Occasional', 'Moderate', 'Heavy', 'Former', 'Unknown'),
    alcoholDetails: Joi.object({
      frequency: Joi.string(),
      amount: Joi.string(),
      lastUse: Joi.date(),
      yearsOfUse: Joi.number()
    }),
    recreationalDrugUse: Joi.string().valid('None', 'Current', 'Former', 'Unknown'),
    recreationalDrugDetails: Joi.object({
      substances: Joi.array().items(Joi.string()),
      frequency: Joi.string(),
      lastUse: Joi.date(),
      routeOfAdministration: Joi.array().items(Joi.string())
    }),
    exercise: Joi.string().valid('None', 'Occasional', 'Moderate', 'Regular', 'Intense'),
    exerciseDetails: Joi.object({
      types: Joi.array().items(Joi.string()),
      frequencyPerWeek: Joi.number().min(0).max(7),
      durationMinutes: Joi.number()
    }),
    diet: Joi.string().valid('Regular', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Low-Sodium', 'Low-Fat', 'Diabetic', 'Other'),
    dietaryRestrictions: Joi.array().items(Joi.string()),
    occupation: Joi.string(),
    occupationalHazards: Joi.array().items(Joi.string()),
    sleepPatterns: Joi.string(),
    stressLevel: Joi.string().valid('Low', 'Moderate', 'High', 'Severe'),
    caffeineConsumption: Joi.string().valid('None', 'Light', 'Moderate', 'Heavy')
  }).min(1) // At least one field must be provided
};

module.exports = patientProfileValidators;
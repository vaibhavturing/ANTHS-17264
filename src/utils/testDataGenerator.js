/**
 * Test Data Generator Utility
 * 
 * This utility provides functions to generate fake patient data for testing purposes.
 * IMPORTANT: 
 * - This file should only be used in test/development environments
 * - No real patient data should ever be used
 * - All test databases should be wiped after testing is complete
 */

const mongoose = require('mongoose');
const faker = require('faker');
const logger = require('./logger');
const { hashPassword } = require('./auth');

/**
 * Common medical conditions for test data
 */
const MEDICAL_CONDITIONS = [
  'Hypertension',
  'Type 2 Diabetes',
  'Asthma',
  'Osteoarthritis',
  'Hypothyroidism',
  'Hypercholesterolemia',
  'GERD',
  'Depression',
  'Anxiety',
  'Migraine',
  'Allergic Rhinitis',
  'Eczema',
  'COPD',
  'Osteoporosis',
  'Rheumatoid Arthritis',
  'Fibromyalgia'
];

/**
 * Common medications for test data
 */
const MEDICATIONS = [
  'Lisinopril',
  'Metformin',
  'Levothyroxine',
  'Atorvastatin',
  'Amlodipine',
  'Metoprolol',
  'Albuterol',
  'Omeprazole',
  'Losartan',
  'Gabapentin',
  'Sertraline',
  'Fluticasone',
  'Montelukast',
  'Furosemide',
  'Pantoprazole',
  'Escitalopram'
];

/**
 * Generate a random date within a range
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Date} Random date within range
 */
const randomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

/**
 * Generate a single fake patient
 * @param {Object} options - Options for patient generation
 * @returns {Object} Fake patient data
 */
const generateFakePatient = (options = {}) => {
  const gender = options.gender || (Math.random() > 0.5 ? 'male' : 'female');
  const firstName = faker.name.firstName(gender);
  const lastName = faker.name.lastName();
  const birthdate = options.birthdate || randomDate(new Date(1940, 0, 1), new Date(2005, 0, 1));
  const age = new Date().getFullYear() - birthdate.getFullYear();
  
  // Generate 1-3 random medical conditions
  const conditionCount = options.conditionCount || Math.floor(Math.random() * 3) + 1;
  const medicalConditions = [];
  const usedConditionIndices = new Set();
  
  for (let i = 0; i < conditionCount; i++) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * MEDICAL_CONDITIONS.length);
    } while (usedConditionIndices.has(randomIndex));
    
    usedConditionIndices.add(randomIndex);
    medicalConditions.push(MEDICAL_CONDITIONS[randomIndex]);
  }
  
  return {
    _id: new mongoose.Types.ObjectId(),
    firstName,
    lastName,
    email: options.email || faker.internet.email(firstName, lastName).toLowerCase(),
    phoneNumber: faker.phone.phoneNumberFormat(),
    dateOfBirth: birthdate,
    gender,
    address: {
      street: faker.address.streetAddress(),
      city: faker.address.city(),
      state: faker.address.stateAbbr(),
      zipCode: faker.address.zipCode('#####')
    },
    emergencyContact: {
      name: faker.name.findName(),
      relationship: ['Spouse', 'Parent', 'Child', 'Sibling'][Math.floor(Math.random() * 4)],
      phoneNumber: faker.phone.phoneNumberFormat()
    },
    medicalConditions,
    allergies: Math.random() > 0.7 ? 
      [MEDICATIONS[Math.floor(Math.random() * MEDICATIONS.length)]] : 
      [],
    insuranceInformation: {
      provider: ['Blue Cross', 'Aetna', 'United Healthcare', 'Cigna'][Math.floor(Math.random() * 4)],
      policyNumber: faker.random.alphaNumeric(10).toUpperCase(),
      groupNumber: faker.random.alphaNumeric(6).toUpperCase()
    }
  };
};

/**
 * Generate fake medical record data for a patient
 * @param {Object} patient - Patient object
 * @returns {Object} Medical record data
 */
const generateMedicalRecord = (patient) => {
  const visitDate = randomDate(new Date(2020, 0, 1), new Date());
  const condition = patient.medicalConditions[Math.floor(Math.random() * patient.medicalConditions.length)];
  
  return {
    _id: new mongoose.Types.ObjectId(),
    patientId: patient._id,
    recordType: ['Visit Note', 'Lab Result', 'Imaging', 'Referral'][Math.floor(Math.random() * 4)],
    date: visitDate,
    provider: {
      name: faker.name.findName(),
      specialty: ['Family Medicine', 'Internal Medicine', 'Cardiology', 'Endocrinology'][Math.floor(Math.random() * 4)],
      providerId: new mongoose.Types.ObjectId()
    },
    chiefComplaint: `Follow-up for ${condition}`,
    vitalSigns: {
      temperature: (Math.random() * 1 + 97.6).toFixed(1),
      heartRate: Math.floor(Math.random() * 20 + 65),
      respiratoryRate: Math.floor(Math.random() * 6 + 14),
      bloodPressure: `${Math.floor(Math.random() * 40 + 110)}/${Math.floor(Math.random() * 20 + 70)}`
    },
    assessment: `Patient presents for follow-up of ${condition}. ` + 
      faker.lorem.paragraph(),
    plan: faker.lorem.paragraph(),
    medications: patient.medicalConditions.map(condition => {
      return {
        name: MEDICATIONS[Math.floor(Math.random() * MEDICATIONS.length)],
        dosage: ['5mg', '10mg', '25mg', '50mg', '100mg'][Math.floor(Math.random() * 5)],
        frequency: ['Once daily', 'Twice daily', 'Three times daily', 'As needed'][Math.floor(Math.random() * 4)]
      };
    })
  };
};

/**
 * Generate a fake prescription for a patient
 * @param {Object} patient - Patient object
 * @param {Object} doctor - Doctor object
 * @returns {Object} Prescription data
 */
const generatePrescription = (patient, doctor) => {
  const medication = MEDICATIONS[Math.floor(Math.random() * MEDICATIONS.length)];
  const condition = patient.medicalConditions[Math.floor(Math.random() * patient.medicalConditions.length)];
  const date = randomDate(new Date(2023, 0, 1), new Date());
  
  return {
    _id: new mongoose.Types.ObjectId(),
    patientId: patient._id,
    doctorId: doctor._id,
    date: date,
    status: ['draft', 'active', 'completed', 'cancelled'][Math.floor(Math.random() * 4)],
    medications: [{
      medicationId: new mongoose.Types.ObjectId(),
      name: medication,
      dosage: ['5mg', '10mg', '25mg', '50mg', '100mg'][Math.floor(Math.random() * 5)],
      frequency: ['Once daily', 'Twice daily', 'Three times daily', 'As needed'][Math.floor(Math.random() * 4)],
      quantity: Math.floor(Math.random() * 60) + 30,
      refills: Math.floor(Math.random() * 3)
    }],
    pharmacy: {
      pharmacyId: new mongoose.Types.ObjectId(),
      name: faker.company.companyName() + ' Pharmacy',
      address: {
        street: faker.address.streetAddress(),
        city: faker.address.city(),
        state: faker.address.stateAbbr(),
        zipCode: faker.address.zipCode('#####')
      },
      phone: faker.phone.phoneNumberFormat()
    },
    instructions: `Take as directed for ${condition}.`,
    notes: Math.random() > 0.7 ? faker.lorem.sentence() : null
  };
};

/**
 * Generate a batch of fake patients with optional records and prescriptions
 * @param {number} count - Number of patients to generate
 * @param {boolean} withRecords - Whether to include medical records
 * @param {boolean} withPrescriptions - Whether to include prescriptions
 * @param {Object} options - Additional options
 * @returns {Object} Object containing arrays of generated data
 */
const generateFakePatientBatch = (count = 10, withRecords = false, withPrescriptions = false, options = {}) => {
  const patients = [];
  const medicalRecords = [];
  const prescriptions = [];
  
  // Create a fake doctor for prescriptions
  const doctor = {
    _id: new mongoose.Types.ObjectId(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    specialty: ['Family Medicine', 'Internal Medicine', 'Cardiology', 'Endocrinology'][Math.floor(Math.random() * 4)]
  };
  
  // Generate patients
  for (let i = 0; i < count; i++) {
    const patient = generateFakePatient(options);
    patients.push(patient);
    
    // Generate medical records if requested
    if (withRecords) {
      const recordCount = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < recordCount; j++) {
        medicalRecords.push(generateMedicalRecord(patient));
      }
    }
    
    // Generate prescriptions if requested
    if (withPrescriptions) {
      const prescriptionCount = Math.floor(Math.random() * 3) + 1;
      for (let k = 0; k < prescriptionCount; k++) {
        prescriptions.push(generatePrescription(patient, doctor));
      }
    }
  }
  
  return {
    patients,
    medicalRecords,
    prescriptions,
    doctor
  };
};

/**
 * Create test users with different roles
 * @returns {Promise<Array>} Array of created user objects
 */
const generateTestUsers = async () => {
  try {
    const roles = ['admin', 'doctor', 'nurse', 'receptionist'];
    const users = [];
    
    for (const role of roles) {
      users.push({
        _id: new mongoose.Types.ObjectId(),
        email: `test.${role}@healthapp.test`,
        password: await hashPassword('Test123!'),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        role
      });
    }
    
    return users;
  } catch (error) {
    logger.error('Error generating test users', error);
    throw error;
  }
};

/**
 * Clear all test data from the database
 * @param {mongoose.Connection} db - Database connection
 * @returns {Promise<void>}
 */
const clearTestData = async (db) => {
  try {
    const collections = await db.connection.db.collections();
    
    for (const collection of collections) {
      if (collection.collectionName.startsWith('test')) {
        await collection.deleteMany({});
      }
    }
    
    logger.info('Test data cleared successfully');
  } catch (error) {
    logger.error('Error clearing test data', error);
    throw error;
  }
};

module.exports = {
  generateFakePatient,
  generateFakePatientBatch,
  generateMedicalRecord,
  generatePrescription,
  generateTestUsers,
  clearTestData
};
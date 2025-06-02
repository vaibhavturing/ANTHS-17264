/**
 * Test Helpers
 * Utility functions for tests
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../src/models/user.model');
const Patient = require('../src/models/patient.model');
const Doctor = require('../src/models/doctor.model');
const config = require('../src/config/config');

/**
 * Generate a valid JWT token for testing
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      role: user.role 
    },
    config.jwt.secret,
    { 
      expiresIn: config.jwt.expiresIn 
    }
  );
};

/**
 * Create a test user in the database
 * @param {Object} userData - User data for test user
 * @returns {Promise<Object>} Created user object
 */
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    email: `test${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    active: true
  };
  
  const user = new User({
    ...defaultUser,
    ...userData,
    // Hash the password if it's provided in userData
    password: userData.password ? 
      await bcrypt.hash(userData.password, 10) : 
      await bcrypt.hash(defaultUser.password, 10)
  });
  
  await user.save();
  return user.toObject();
};

/**
 * Create a test patient in the database
 * @param {Object} patientData - Patient data for test
 * @param {Object} userData - Associated user data
 * @returns {Promise<Object>} Created patient object
 */
const createTestPatient = async (patientData = {}, userData = {}) => {
  // Create a user for the patient if not provided
  let user;
  if (patientData.userId) {
    user = await User.findById(patientData.userId);
    if (!user) {
      throw new Error(`User with ID ${patientData.userId} not found`);
    }
  } else {
    user = await createTestUser({ 
      role: 'patient',
      ...userData
    });
  }

  const defaultPatient = {
    userId: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: new Date('1990-01-01'),
    gender: 'male',
    contactInformation: {
      email: user.email,
      phone: '555-123-4567',
      address: '123 Test St, Test City, TS 12345'
    },
    medicalInformation: {
      allergies: [],
      medications: [],
      conditions: [],
      patientId: `P${Date.now()}`
    }
  };
  
  const patient = new Patient({
    ...defaultPatient,
    ...patientData
  });
  
  await patient.save();
  return patient.toObject();
};

/**
 * Create a test doctor in the database
 * @param {Object} doctorData - Doctor data for test
 * @param {Object} userData - Associated user data
 * @returns {Promise<Object>} Created doctor object
 */
const createTestDoctor = async (doctorData = {}, userData = {}) => {
  // Create a user for the doctor if not provided
  let user;
  if (doctorData.userId) {
    user = await User.findById(doctorData.userId);
    if (!user) {
      throw new Error(`User with ID ${doctorData.userId} not found`);
    }
  } else {
    user = await createTestUser({ 
      role: 'doctor',
      ...userData
    });
  }

  const defaultDoctor = {
    userId: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    contactInformation: {
      email: user.email,
      phone: '555-987-6543',
      address: '456 Doctor Ave, Medical City, MC 54321'
    },
    professionalDetails: {
      title: 'MD',
      department: 'General Medicine',
      specialties: ['Family Medicine']
    },
    credentials: {
      licenseNumber: 'MD123456',
      licenseState: 'CA',
      licenseExpiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      npiNumber: '1234567890',
      boardCertifications: ['American Board of Family Medicine']
    }
  };
  
  const doctor = new Doctor({
    ...defaultDoctor,
    ...doctorData
  });
  
  await doctor.save();
  return doctor.toObject();
};

/**
 * Clean up created test data
 * @param {Array} userIds - Array of user IDs to delete
 * @param {Array} patientIds - Array of patient IDs to delete
 * @param {Array} doctorIds - Array of doctor IDs to delete
 * @returns {Promise<void>}
 */
const cleanupTestData = async (userIds = [], patientIds = [], doctorIds = []) => {
  const deletePromises = [];
  
  if (patientIds.length > 0) {
    deletePromises.push(Patient.deleteMany({ _id: { $in: patientIds } }));
  }
  
  if (doctorIds.length > 0) {
    deletePromises.push(Doctor.deleteMany({ _id: { $in: doctorIds } }));
  }
  
  if (userIds.length > 0) {
    deletePromises.push(User.deleteMany({ _id: { $in: userIds } }));
  }
  
  await Promise.all(deletePromises);
};

/**
 * Create a sample medical record with randomly generated data
 * @returns {Object} Generated medical record object
 */
const createSampleMedicalRecord = (patientId, doctorId) => {
  return {
    patientId: patientId || new mongoose.Types.ObjectId(),
    providerId: doctorId || new mongoose.Types.ObjectId(),
    visitDate: new Date(),
    recordType: 'visit',
    chiefComplaint: 'Routine checkup',
    vitalSigns: {
      temperature: 98.6,
      heartRate: 72,
      bloodPressure: '120/80',
      respiratoryRate: 16,
      height: 180,
      weight: 80
    },
    diagnosis: [{
      code: 'Z00.00',
      description: 'Encounter for general adult medical examination without abnormal findings',
      diagnosisDate: new Date()
    }],
    notes: 'Patient appears to be in good health. No significant findings.'
  };
};

module.exports = {
  generateToken,
  createTestUser,
  createTestPatient,
  createTestDoctor,
  cleanupTestData,
  createSampleMedicalRecord
};
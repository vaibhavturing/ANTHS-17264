const Patient = require('../models/patient.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, BusinessLogicError } = require('../utils/errors');
const config = require('../config/config');
const emailService = require('./email.service');
const bcrypt = require('bcrypt');

/**
 * Patient registration and management service
 */
const patientService = {
  /**
   * Register a new patient with their account information
   * @param {Object} patientData - Patient registration data
   * @returns {Promise<Object>} The created patient record
   */
  registerPatient: async (patientData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.info('Starting patient registration process');
      
      // First check if email is already in use
      const existingUser = await User.findOne({ email: patientData.email });
      if (existingUser) {
        throw new ValidationError('Email is already in use');
      }
      
      // Create user account
      const newUser = new User({
        email: patientData.email,
        password: patientData.password,
        firstName: patientData.firstName,
        lastName: patientData.lastName,
        role: 'patient',
        roles: [], // Will be populated after role setup
        isActive: true,
        isVerified: false
      });
      
      // Save user
      await newUser.save({ session });
      
      // Create patient record
      const newPatient = new Patient({
        user: newUser._id,
        dateOfBirth: patientData.dateOfBirth,
        gender: patientData.gender,
        ssn: patientData.ssn,
        maritalStatus: patientData.maritalStatus,
        
        address: patientData.address,
        phoneNumber: patientData.phoneNumber,
        alternatePhoneNumber: patientData.alternatePhoneNumber,
        preferredContactMethod: patientData.preferredContactMethod,
        
        // Add first emergency contact
        emergencyContacts: [patientData.emergencyContact],
        
        // Insurance information
        insurance: patientData.insurance,
        secondaryInsurance: patientData.secondaryInsurance,
        
        // Add consents based on the checkboxes
        consents: [
          {
            type: 'HIPAA',
            givenDate: new Date(),
            documentReference: 'HIPAA_CONSENT_V1'
          },
          {
            type: 'Treatment',
            givenDate: new Date(),
            documentReference: 'TREATMENT_CONSENT_V1'
          }
        ],
        
        registrationStatus: 'Pending',
        registrationDate: new Date(),
        missingDocuments: ['Insurance Verification', 'Photo ID']
      });
      
      // Save patient
      await newPatient.save({ session });
      
      // Email notification to admin for new patient registration
      if (config.ENABLE_NOTIFICATIONS) {
        /* 
        In production, we would send an email notification
        await emailService.sendAdminNotification({
          type: 'NEW_PATIENT',
          data: {
            patientId: newPatient._id,
            name: `${newUser.firstName} ${newUser.lastName}`,
            email: newUser.email
          }
        });

        // Send welcome email to patient
        await emailService.sendPatientWelcome({
          to: newUser.email,
          name: newUser.firstName,
          portalUrl: config.PATIENT_PORTAL_URL
        });
        */
      }
      
      // Commit transaction
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`New patient registered successfully: ${newUser.email}`);

      // Return sanitized patient data (without sensitive fields)
      return {
        patient: {
          _id: newPatient._id,
          name: `${newUser.firstName} ${newUser.lastName}`,
          email: newUser.email,
          registrationStatus: newPatient.registrationStatus,
          registrationDate: newPatient.registrationDate,
          missingDocuments: newPatient.missingDocuments
        }
      };
    } catch (error) {
      // Rollback transaction on error
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Patient registration failed', {
        error: error.message,
        stack: error.stack
      });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new Error('Failed to register patient: ' + error.message);
    }
  },

  /**
   * Check if a patient with given SSN already exists
   * @param {string} ssn - Social Security Number
   * @returns {Promise<boolean>} True if SSN is already registered
   */
  checkDuplicateSSN: async (ssn) => {
    try {
      // Format SSN consistently for comparison (remove dashes)
      const formattedSSN = ssn.replace(/-/g, '');
      
      // Fetch all patients (this approach is not efficient for large datasets)
      // In a real implementation, you would hash the input SSN and compare against stored hashes
      // or use a more efficient method for secure comparison
      const patients = await Patient.find().select('+ssn');
      
      let isDuplicate = false;
      
      // Check each patient's SSN
      for (let patient of patients) {
        const isMatch = await bcrypt.compare(formattedSSN, patient.ssn);
        if (isMatch) {
          isDuplicate = true;
          break;
        }
      }
      
      return isDuplicate;
    } catch (error) {
      logger.error('Error checking for duplicate SSN', {
        error: error.message
      });
      throw new Error('Failed to verify patient information');
    }
  },

  /**
   * Get patient by ID
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Patient record
   */
  getPatientById: async (patientId) => {
    try {
      const patient = await Patient.findById(patientId).populate('user', 'firstName lastName email');
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      return patient;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Error retrieving patient', {
        patientId,
        error: error.message
      });
      
      throw new Error('Failed to retrieve patient information');
    }
  },
  
  /**
   * Update patient information
   * @param {string} patientId - Patient ID
   * @param {Object} updateData - The data to update
   * @returns {Promise<Object>} Updated patient record
   */
  updatePatient: async (patientId, updateData) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Update specific fields from updateData
      Object.keys(updateData).forEach(key => {
        // Special handling for nested objects like address
        if (typeof updateData[key] === 'object' && updateData[key] !== null) {
          // If the patient has this object already, update it, otherwise set it
          patient[key] = patient[key] ? { ...patient[key], ...updateData[key] } : updateData[key];
        } else {
          patient[key] = updateData[key];
        }
      });
      
      // If this completes profile, update registration status
      if (patient.registrationStatus === 'Incomplete' && !patient.missingDocuments.length) {
        patient.registrationStatus = 'Pending';
        patient.registrationCompletedDate = new Date();
      }
      
      await patient.save();
      
      return patient;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Error updating patient', {
        patientId,
        error: error.message
      });
      
      throw new Error('Failed to update patient information');
    }
  },
  
  /**
   * Add or update consents for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} consentData - Consent data to add
   * @returns {Promise<Object>} Updated patient record
   */
  addConsent: async (patientId, consentData) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Check if this consent type already exists
      const existingConsentIndex = patient.consents.findIndex(
        consent => consent.type === consentData.type && !consent.revoked
      );
      
      if (existingConsentIndex >= 0) {
        // Update existing consent
        patient.consents[existingConsentIndex] = {
          ...patient.consents[existingConsentIndex],
          givenDate: new Date(),
          expirationDate: consentData.expirationDate,
          documentReference: consentData.documentReference || patient.consents[existingConsentIndex].documentReference
        };
      } else {
        // Add new consent
        patient.consents.push({
          type: consentData.type,
          givenDate: new Date(),
          expirationDate: consentData.expirationDate,
          documentReference: consentData.documentReference,
          revoked: false
        });
      }
      
      await patient.save();
      
      return patient;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Error adding patient consent', {
        patientId,
        error: error.message
      });
      
      throw new Error('Failed to update patient consent information');
    }
  },
  
  /**
   * Update patient registration status
   * @param {string} patientId - Patient ID
   * @param {string} status - New status ('Approved', 'Rejected', 'Pending')
   * @param {string} notes - Optional notes about the status change
   * @returns {Promise<Object>} Updated patient record
   */
  updateRegistrationStatus: async (patientId, status, notes) => {
    try {
      const patient = await Patient.findById(patientId).populate('user');
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Update status
      patient.registrationStatus = status;
      
      if (notes) {
        patient.registrationNotes = notes;
      }
      
      // If approved, update user account to verified
      if (status === 'Approved') {
        await User.findByIdAndUpdate(patient.user._id, {
          isVerified: true
        });
        
        // Send email notification to patient about approval
        if (config.ENABLE_NOTIFICATIONS) {
          // In production implementation we would uncomment this:
          /*
          await emailService.sendPatientNotification({
            to: patient.user.email,
            subject: 'Your Registration Has Been Approved',
            name: patient.user.firstName,
            message: 'Your registration with our healthcare system has been approved. You now have full access to all patient portal features.',
            actionUrl: config.PATIENT_PORTAL_URL,
            actionText: 'Access Patient Portal'
          });
          */
        }
      }
      
      await patient.save();
      
      return patient;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Error updating patient registration status', {
        patientId,
        status,
        error: error.message
      });
      
      throw new Error('Failed to update patient registration status');
    }
  },
  
  /**
   * Get patients by registration status
   * @param {string} status - Registration status to filter by
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} List of patients and pagination metadata
   */
  getPatientsByStatus: async (status, options = { page: 1, limit: 10 }) => {
    try {
      const skip = (options.page - 1) * options.limit;
      
      const patients = await Patient.find({ registrationStatus: status })
        .populate('user', 'firstName lastName email')
        .sort({ registrationDate: -1 })
        .skip(skip)
        .limit(options.limit);
        
      const total = await Patient.countDocuments({ registrationStatus: status });
      
      return {
        patients,
        pagination: {
          total,
          page: options.page,
          limit: options.limit,
          pages: Math.ceil(total / options.limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching patients by status', {
        status,
        error: error.message
      });
      
      throw new Error('Failed to retrieve patient list');
    }
  },
  
  /**
   * Search patients by various criteria
   * @param {Object} searchParams - Search parameters
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Search results and pagination metadata
   */
  searchPatients: async (searchParams, options = { page: 1, limit: 10 }) => {
    try {
      const skip = (options.page - 1) * options.limit;
      const query = {};
      
      // Build query based on search parameters
      if (searchParams.name) {
        // This requires an aggregation pipeline with $lookup to search user's name
        // For simplicity, we'll implement a basic version here
        const nameRegex = new RegExp(searchParams.name, 'i');
        const matchingUsers = await User.find({
          $or: [
            { firstName: nameRegex },
            { lastName: nameRegex }
          ]
        }).select('_id');
        
        query.user = { $in: matchingUsers.map(u => u._id) };
      }
      
      if (searchParams.registrationStatus) {
        query.registrationStatus = searchParams.registrationStatus;
      }
      
      if (searchParams.insuranceProvider) {
        query['insurance.provider'] = new RegExp(searchParams.insuranceProvider, 'i');
      }
      
      if (searchParams.registrationDateStart && searchParams.registrationDateEnd) {
        query.registrationDate = {
          $gte: new Date(searchParams.registrationDateStart),
          $lte: new Date(searchParams.registrationDateEnd)
        };
      } else if (searchParams.registrationDateStart) {
        query.registrationDate = { $gte: new Date(searchParams.registrationDateStart) };
      } else if (searchParams.registrationDateEnd) {
        query.registrationDate = { $lte: new Date(searchParams.registrationDateEnd) };
      }
      
      // Execute search query
      const patients = await Patient.find(query)
        .populate('user', 'firstName lastName email')
        .sort({ registrationDate: -1 })
        .skip(skip)
        .limit(options.limit);
        
      const total = await Patient.countDocuments(query);
      
      return {
        patients,
        pagination: {
          total,
          page: options.page,
          limit: options.limit,
          pages: Math.ceil(total / options.limit)
        }
      };
    } catch (error) {
      logger.error('Error searching patients', {
        searchParams,
        error: error.message
      });
      
      throw new Error('Failed to search patients');
    }
  }
};

module.exports = patientService;
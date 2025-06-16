const Patient = require('../models/patient.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, BusinessLogicError } = require('../utils/errors');
const config = require('../config/config');
const emailService = require('./email.service');
const bcrypt = require('bcrypt');
const MedicalHistory = require('../models/medicalHistory.model');
const Allergy = require('../models/allergy.model');
const Medication = require('../models/medication.model');
const VisitNote = require('../models/visitNote.model');
const LabResult = require('../models/labResult.model');

/**
 * Service for patient profile management
 */
const patientService = {
  /**
   * Create a new patient profile
   * @param {Object} patientData - Patient data
   * @param {String} userId - User ID associated with patient
   * @returns {Promise<Object>} Newly created patient
   */
  createPatient: async (patientData, userId) => {
    try {
      // Verify user exists
      const userExists = await User.findById(userId);
      if (!userExists) {
        throw new NotFoundError('User not found');
      }

      // Check if patient profile already exists for user
      const existingPatient = await Patient.findOne({ userId });
      if (existingPatient) {
        throw new ValidationError('Patient profile already exists for this user');
      }

      const patientToCreate = {
        ...patientData,
        userId
      };

      const patient = new Patient(patientToCreate);
      await patient.save();
      
      return patient;
    } catch (error) {
      logger.error('Error creating patient profile', {
        error: error.message,
        userId
      });
      throw error;
    }
  },

  /**
   * Get patient by ID
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Patient data
   */
  getPatientById: async (patientId) => {
    try {
      const patient = await Patient.findById(patientId)
        .populate('primaryPhysician', 'firstName lastName email')
        .populate('insuranceInfo');
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      return patient;
    } catch (error) {
      logger.error('Error fetching patient', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },

  /**
   * Get patient profile by user ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Patient data
   */
  getPatientByUserId: async (userId) => {
    try {
      const patient = await Patient.findOne({ userId })
        .populate('primaryPhysician', 'firstName lastName email')
        .populate('insuranceInfo');
      
      if (!patient) {
        throw new NotFoundError('Patient profile not found');
      }
      
      return patient;
    } catch (error) {
      logger.error('Error fetching patient by user ID', {
        error: error.message,
        userId
      });
      throw error;
    }
  },

  /**
   * Update patient profile
   * @param {String} patientId - Patient ID
   * @param {Object} updateData - Updated patient data
   * @returns {Promise<Object>} Updated patient
   */
  updatePatient: async (patientId, updateData) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Update patient data
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          patient[key] = updateData[key];
        }
      });
      
      await patient.save();
      return patient;
    } catch (error) {
      logger.error('Error updating patient', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },

  /**
   * Get patient's complete medical profile
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Complete patient profile with all medical records
   */
  getPatientProfile: async (patientId) => {
    try {
      const patient = await Patient.findById(patientId)
        .populate('primaryPhysician', 'firstName lastName email')
        .populate('insuranceInfo');
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Get all related medical data
      const [medicalHistory, allergies, medications, visitNotes, labResults] = await Promise.all([
        MedicalHistory.find({ patient: patientId })
          .populate('diagnosedBy', 'firstName lastName')
          .populate('relatedLabResults')
          .sort({ diagnosisDate: -1 }),
        
        Allergy.find({ patient: patientId })
          .populate('reportedBy', 'firstName lastName')
          .sort({ createdAt: -1 }),
        
        Medication.find({ patient: patientId })
          .populate('prescribedBy', 'firstName lastName')
          .populate('relatedCondition')
          .sort({ startDate: -1 }),
        
        VisitNote.find({ patient: patientId })
          .populate('provider', 'firstName lastName')
          .populate('signedBy', 'firstName lastName')
          .sort({ visitDate: -1 }),
        
        LabResult.find({ patient: patientId })
          .populate('orderedBy', 'firstName lastName')
          .populate('relatedDiagnosis')
          .sort({ orderDate: -1 })
      ]);
      
      return {
        patientInfo: patient,
        medicalHistory,
        allergies,
        medications,
        visitNotes,
        labResults
      };
    } catch (error) {
      logger.error('Error fetching complete patient profile', {
        error: error.message,
        patientId
      });
      throw error;
    }
  }
};

module.exports = patientService;
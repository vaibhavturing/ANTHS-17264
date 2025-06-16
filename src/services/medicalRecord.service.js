// src/services/medicalRecord.service.js

const { MedicalRecord, RECORD_CATEGORIES, auditActions } = require('../models/medicalRecord.model');
const { Patient } = require('../models/patient.model');
const { User } = require('../models/user.model');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const Allergy = require('../models/allergy.model');
const Medication = require('../models/medication.model');
const VisitNote = require('../models/visitNote.model');
const LabResult = require('../models/labResult.model');
const Patient = require('../models/patient.model');

/**
 * Service for managing medical records
 */
const medicalRecordService = {
  /**
   * Create a medical history entry
   * @param {Object} historyData - Medical history data
   * @returns {Promise<Object>} Created medical history record
   */
  createMedicalHistory: async (historyData) => {
    try {
      // Verify patient exists
      const patientExists = await Patient.findById(historyData.patient);
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }
      
      const history = new MedicalHistory(historyData);
      await history.save();
      
      return history;
    } catch (error) {
      logger.error('Error creating medical history', {
        error: error.message,
        patientId: historyData.patient
      });
      throw error;
    }
  },
  
  /**
   * Get medical history records for a patient
   * @param {String} patientId - Patient ID
   * @returns {Promise<Array>} Medical history records
   */
  getMedicalHistory: async (patientId) => {
    try {
      const records = await MedicalHistory.find({ patient: patientId })
        .populate('diagnosedBy', 'firstName lastName')
        .populate('relatedLabResults')
        .sort({ diagnosisDate: -1 });
      
      return records;
    } catch (error) {
      logger.error('Error fetching medical history', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Update a medical history record
   * @param {String} recordId - Record ID
   * @param {Object} updateData - Updated medical history data
   * @returns {Promise<Object>} Updated record
   */
  updateMedicalHistory: async (recordId, updateData) => {
    try {
      const record = await MedicalHistory.findByIdAndUpdate(
        recordId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!record) {
        throw new NotFoundError('Medical history record not found');
      }
      
      return record;
    } catch (error) {
      logger.error('Error updating medical history record', {
        error: error.message,
        recordId
      });
      throw error;
    }
  },
  
  /**
   * Create an allergy record
   * @param {Object} allergyData - Allergy data
   * @returns {Promise<Object>} Created allergy record
   */
  createAllergy: async (allergyData) => {
    try {
      // Verify patient exists
      const patientExists = await Patient.findById(allergyData.patient);
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }
      
      const allergy = new Allergy(allergyData);
      await allergy.save();
      
      return allergy;
    } catch (error) {
      logger.error('Error creating allergy record', {
        error: error.message,
        patientId: allergyData.patient
      });
      throw error;
    }
  },
  
  /**
   * Get allergies for a patient
   * @param {String} patientId - Patient ID
   * @returns {Promise<Array>} Allergy records
   */
  getAllergies: async (patientId) => {
    try {
      const allergies = await Allergy.find({ patient: patientId })
        .populate('reportedBy', 'firstName lastName')
        .sort({ createdAt: -1 });
      
      return allergies;
    } catch (error) {
      logger.error('Error fetching allergies', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Create a medication record
   * @param {Object} medicationData - Medication data
   * @returns {Promise<Object>} Created medication record
   */
  createMedication: async (medicationData) => {
    try {
      // Verify patient exists
      const patientExists = await Patient.findById(medicationData.patient);
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }
      
      const medication = new Medication(medicationData);
      await medication.save();
      
      return medication;
    } catch (error) {
      logger.error('Error creating medication record', {
        error: error.message,
        patientId: medicationData.patient
      });
      throw error;
    }
  },
  
  /**
   * Get medications for a patient
   * @param {String} patientId - Patient ID
   * @returns {Promise<Array>} Medication records
   */
  getMedications: async (patientId) => {
    try {
      const medications = await Medication.find({ patient: patientId })
        .populate('prescribedBy', 'firstName lastName')
        .populate('relatedCondition')
        .sort({ startDate: -1 });
      
      return medications;
    } catch (error) {
      logger.error('Error fetching medications', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Create a visit note
   * @param {Object} noteData - Visit note data
   * @returns {Promise<Object>} Created visit note
   */
  createVisitNote: async (noteData) => {
    try {
      // Verify patient exists
      const patientExists = await Patient.findById(noteData.patient);
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }
      
      const note = new VisitNote(noteData);
      await note.save();
      
      return note;
    } catch (error) {
      logger.error('Error creating visit note', {
        error: error.message,
        patientId: noteData.patient
      });
      throw error;
    }
  },
  
  /**
   * Get visit notes for a patient
   * @param {String} patientId - Patient ID
   * @returns {Promise<Array>} Visit note records
   */
  getVisitNotes: async (patientId) => {
    try {
      const notes = await VisitNote.find({ patient: patientId })
        .populate('provider', 'firstName lastName')
        .populate('signedBy', 'firstName lastName')
        .populate({
          path: 'prescriptions',
          select: 'name dosage frequency'
        })
        .populate({
          path: 'labOrders',
          select: 'testName orderDate status'
        })
        .sort({ visitDate: -1 });
      
      return notes;
    } catch (error) {
      logger.error('Error fetching visit notes', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Create a lab result record
   * @param {Object} labData - Lab result data
   * @returns {Promise<Object>} Created lab result record
   */
  createLabResult: async (labData) => {
    try {
      // Verify patient exists
      const patientExists = await Patient.findById(labData.patient);
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }
      
      const labResult = new LabResult(labData);
      await labResult.save();
      
      // If this lab result is linked to a diagnosis, update the diagnosis to include this lab result
      if (labData.relatedDiagnosis) {
        await MedicalHistory.findByIdAndUpdate(
          labData.relatedDiagnosis,
          { $addToSet: { relatedLabResults: labResult._id } }
        );
      }
      
      return labResult;
    } catch (error) {
      logger.error('Error creating lab result', {
        error: error.message,
        patientId: labData.patient
      });
      throw error;
    }
  },
  
  /**
   * Get lab results for a patient
   * @param {String} patientId - Patient ID
   * @returns {Promise<Array>} Lab result records
   */
  getLabResults: async (patientId) => {
    try {
      const labResults = await LabResult.find({ patient: patientId })
        .populate('orderedBy', 'firstName lastName')
        .populate('relatedDiagnosis')
        .sort({ orderDate: -1 });
      
      return labResults;
    } catch (error) {
      logger.error('Error fetching lab results', {
        error: error.message,
        patientId
      });
      throw error;
    }
  }
};

module.exports = medicalRecordService;
const Patient = require('../models/patient.model');
const PatientProfileVersion = require('../models/patientProfileVersion.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const profileVersionService = require('./profile-version.service');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/config');

/**
 * Patient profile management service
 */
const patientProfileService = {
  /**
   * Get comprehensive patient profile with role-based visibility
   * @param {string} patientId - Patient ID
   * @param {Object} requestingUser - User requesting the profile
   * @returns {Promise<Object>} Patient profile with appropriate visibility
   */
  getProfile: async (patientId, requestingUser) => {
    try {
      // Fetch patient with populated references
      const patient = await Patient.findById(patientId)
        .populate('user', 'firstName lastName email')
        .populate('primaryCarePhysician.provider', 'firstName lastName specialization')
        .populate('specialists.provider', 'firstName lastName specialization');
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Apply role-based field visibility
      const visibleProfile = patient.getFieldsVisibleTo(requestingUser.role);
      
      // Check if this is the patient's own record
      if (patient.user._id.toString() === requestingUser._id.toString()) {
        // Patient viewing their own record - add additional context
        visibleProfile.isOwnProfile = true;
        
        // Get the latest version information
        visibleProfile.versionInfo = {
          currentVersion: patient.currentVersion,
          lastUpdated: patient.lastUpdated
        };
      }
      
      return visibleProfile;
    } catch (error) {
      logger.error('Error retrieving patient profile', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Update patient profile with version tracking
   * @param {string} patientId - Patient ID
   * @param {Object} updateData - Data to update
   * @param {Object} requestingUser - User making the update
   * @param {string} updateReason - Reason for the update
   * @returns {Promise<Object>} Updated profile
   */
  updateProfile: async (patientId, updateData, requestingUser, updateReason = '') => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Fetch current patient data for version comparison
      const currentPatient = await Patient.findById(patientId);
      
      if (!currentPatient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Keep track of changes for the version history
      const oldData = currentPatient.toObject();
      
      // Apply updates to the patient
      Object.keys(updateData).forEach(key => {
        if (typeof updateData[key] === 'object' && updateData[key] !== null && !Array.isArray(updateData[key])) {
          // For nested objects, merge instead of replace
          currentPatient[key] = {
            ...currentPatient[key],
            ...updateData[key]
          };
        } else {
          // For arrays and primitives, replace
          currentPatient[key] = updateData[key];
        }
      });
      
      // Update metadata
      currentPatient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: Object.keys(updateData)
      };
      
      // Save with session
      await currentPatient.save({ session });
      
      // Create version history entry
      await profileVersionService.createVersion(
        patientId,
        oldData,
        currentPatient.toObject(),
        requestingUser,
        updateReason
      );
      
      // Commit transaction
      await session.commitTransaction();
      
      logger.info(`Patient profile updated for ${patientId} by ${requestingUser._id}`);
      
      // Return updated profile with appropriate visibility
      return currentPatient.getFieldsVisibleTo(requestingUser.role);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      
      logger.error('Error updating patient profile', {
        patientId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    } finally {
      session.endSession();
    }
  },
  
  /**
   * Add vital signs record to patient profile
   * @param {string} patientId - Patient ID
   * @param {Object} vitalData - Vital signs data
   * @param {Object} requestingUser - User recording vitals
   * @returns {Promise<Object>} Updated vital signs
   */
  recordVitalSigns: async (patientId, vitalData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Get current vitals for version tracking
      const oldVitals = patient.vitalSigns ? { ...patient.vitalSigns.toObject() } : {};
      
      // Update vital signs with new data and recording timestamps
      const timestamp = new Date();
      
      // Initialize vitalSigns object if it doesn't exist
      if (!patient.vitalSigns) {
        patient.vitalSigns = {};
      }
      
      // Update only provided values
      Object.keys(vitalData).forEach(key => {
        if (vitalData[key] !== undefined && vitalData[key] !== null) {
          // Each vital sign needs value and recordedAt fields
          patient.vitalSigns[key] = {
            ...patient.vitalSigns[key], // Preserve existing fields
            ...vitalData[key],          // Add new values
            recordedAt: timestamp       // Update timestamp
          };
        }
      });
      
      // Calculate BMI if height and weight are provided
      if (
        patient.vitalSigns.height?.value && 
        patient.vitalSigns.weight?.value &&
        patient.vitalSigns.height.unit && 
        patient.vitalSigns.weight.unit
      ) {
        // Convert to metric for BMI calculation if needed
        let heightInM = patient.vitalSigns.height.value;
        if (patient.vitalSigns.height.unit === 'in') {
          heightInM = heightInM * 0.0254; // inches to meters
        } else {
          heightInM = heightInM / 100; // cm to meters
        }
        
        let weightInKg = patient.vitalSigns.weight.value;
        if (patient.vitalSigns.weight.unit === 'lb') {
          weightInKg = weightInKg * 0.453592; // pounds to kg
        }
        
        // Calculate BMI: weight(kg) / (height(m))^2
        const bmi = weightInKg / (heightInM * heightInM);
        
        patient.vitalSigns.bmi = {
          value: parseFloat(bmi.toFixed(1)),
          recordedAt: timestamp
        };
      }
      
      // Update metadata
      patient.lastUpdated = {
        date: timestamp,
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: ['vitalSigns']
      };
      
      await patient.save();
      
      // Create version history for vital signs
      await profileVersionService.createVersion(
        patientId,
        { vitalSigns: oldVitals },
        { vitalSigns: patient.vitalSigns },
        requestingUser,
        'Updated vital signs'
      );
      
      return patient.vitalSigns;
    } catch (error) {
      logger.error('Error recording vital signs', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Add allergy to patient profile
   * @param {string} patientId - Patient ID
   * @param {Object} allergyData - Allergy information
   * @param {Object} requestingUser - User recording allergy
   * @returns {Promise<Object>} Updated allergies array
   */
  addAllergy: async (patientId, allergyData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Check for duplicate allergy
      const existingAllergy = patient.allergies.find(a => 
        a.allergen.toLowerCase() === allergyData.allergen.toLowerCase() &&
        a.status === 'Active'
      );
      
      if (existingAllergy) {
        throw new ValidationError('This active allergy is already recorded for the patient');
      }
      
      // Add user and timestamp to allergies
      const newAllergy = {
        ...allergyData,
        documentedBy: {
          user: requestingUser._id,
          date: new Date()
        }
      };
      
      // Get current allergies for version tracking
      const oldAllergies = [...patient.allergies];
      
      // Add new allergy
      patient.allergies.push(newAllergy);
      
      // Update metadata
      patient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: ['allergies']
      };
      
      await patient.save();
      
      // Create version history for allergies
      await profileVersionService.createVersion(
        patientId,
        { allergies: oldAllergies },
        { allergies: patient.allergies },
        requestingUser,
        'Added allergy'
      );
      
      return patient.allergies;
    } catch (error) {
      logger.error('Error adding allergy', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Update an existing allergy
   * @param {string} patientId - Patient ID
   * @param {string} allergyId - Allergy ID (MongoDB ObjectID)
   * @param {Object} allergyData - Updated allergy data
   * @param {Object} requestingUser - User updating allergy
   * @returns {Promise<Object>} Updated allergies array
   */
  updateAllergy: async (patientId, allergyId, allergyData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Find the allergy to update
      const allergyIndex = patient.allergies.findIndex(a => a._id.toString() === allergyId);
      
      if (allergyIndex === -1) {
        throw new NotFoundError('Allergy not found');
      }
      
      // Get current allergies for version tracking
      const oldAllergies = [...patient.allergies];
      
      // Update the allergy
      patient.allergies[allergyIndex] = {
        ...patient.allergies[allergyIndex].toObject(),
        ...allergyData,
        documentedBy: {
          user: requestingUser._id,
          date: new Date()
        }
      };
      
      // Update metadata
      patient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: [`allergies.${allergyIndex}`]
      };
      
      await patient.save();
      
      // Create version history for allergies
      await profileVersionService.createVersion(
        patientId,
        { allergies: oldAllergies },
        { allergies: patient.allergies },
        requestingUser,
        'Updated allergy'
      );
      
      return patient.allergies;
    } catch (error) {
      logger.error('Error updating allergy', {
        patientId,
        allergyId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Add medication to patient profile
   * @param {string} patientId - Patient ID
   * @param {Object} medicationData - Medication information
   * @param {Object} requestingUser - User recording medication
   * @returns {Promise<Object>} Updated medications array
   */
  addMedication: async (patientId, medicationData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Check for duplicate active medication
      const existingMedication = patient.medications.find(m => 
        m.name.toLowerCase() === medicationData.name.toLowerCase() && 
        m.status === 'Active'
      );
      
      if (existingMedication) {
        throw new ValidationError('This active medication is already recorded for the patient');
      }
      
      // Add user and timestamp
      const newMedication = {
        ...medicationData,
        documentedBy: {
          user: requestingUser._id,
          date: new Date()
        }
      };
      
      // Get current medications for version tracking
      const oldMedications = [...patient.medications];
      
      // Add new medication
      patient.medications.push(newMedication);
      
      // Update metadata
      patient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: ['medications']
      };
      
      await patient.save();
      
      // Create version history for medications
      await profileVersionService.createVersion(
        patientId,
        { medications: oldMedications },
        { medications: patient.medications },
        requestingUser,
        'Added medication'
      );
      
      return patient.medications;
    } catch (error) {
      logger.error('Error adding medication', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Add medical history item to patient profile
   * @param {string} patientId - Patient ID
   * @param {Object} historyData - Medical history information
   * @param {Object} requestingUser - User recording history
   * @returns {Promise<Object>} Updated medical history array
   */
  addMedicalHistory: async (patientId, historyData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Add user and timestamp
      const newHistoryItem = {
        ...historyData,
        documentedBy: {
          user: requestingUser._id,
          date: new Date()
        }
      };
      
      // Get current medical history for version tracking
      const oldHistory = [...patient.medicalHistory];
      
      // Add new history item
      patient.medicalHistory.push(newHistoryItem);
      
      // Update metadata
      patient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: ['medicalHistory']
      };
      
      await patient.save();
      
      // Create version history
      await profileVersionService.createVersion(
        patientId,
        { medicalHistory: oldHistory },
        { medicalHistory: patient.medicalHistory },
        requestingUser,
        'Added medical history'
      );
      
      return patient.medicalHistory;
    } catch (error) {
      logger.error('Error adding medical history', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Add family history item to patient profile
   * @param {string} patientId - Patient ID
   * @param {Object} familyHistoryData - Family history information
   * @param {Object} requestingUser - User recording history
   * @returns {Promise<Object>} Updated family history array
   */
  addFamilyHistory: async (patientId, familyHistoryData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Add user and timestamp
      const newFamilyHistoryItem = {
        ...familyHistoryData,
        documentedBy: {
          user: requestingUser._id,
          date: new Date()
        }
      };
      
      // Get current family history for version tracking
      const oldFamilyHistory = [...patient.familyMedicalHistory];
      
      // Add new family history item
      patient.familyMedicalHistory.push(newFamilyHistoryItem);
      
      // Update metadata
      patient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: ['familyMedicalHistory']
      };
      
      await patient.save();
      
      // Create version history
      await profileVersionService.createVersion(
        patientId,
        { familyMedicalHistory: oldFamilyHistory },
        { familyMedicalHistory: patient.familyMedicalHistory },
        requestingUser,
        'Added family medical history'
      );
      
      return patient.familyMedicalHistory;
    } catch (error) {
      logger.error('Error adding family history', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Update lifestyle information
   * @param {string} patientId - Patient ID
   * @param {Object} lifestyleData - Lifestyle information
   * @param {Object} requestingUser - User updating information
   * @returns {Promise<Object>} Updated lifestyle information
   */
  updateLifestyle: async (patientId, lifestyleData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Get current lifestyle for version tracking
      const oldLifestyle = patient.lifestyle ? { ...patient.lifestyle.toObject() } : {};
      
      // Update or initialize lifestyle
      patient.lifestyle = {
        ...(patient.lifestyle || {}),
        ...lifestyleData,
        documentedBy: {
          user: requestingUser._id,
          date: new Date()
        }
      };
      
      // Update metadata
      patient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: ['lifestyle']
      };
      
      await patient.save();
      
      // Create version history
      await profileVersionService.createVersion(
        patientId,
        { lifestyle: oldLifestyle },
        { lifestyle: patient.lifestyle },
        requestingUser,
        'Updated lifestyle information'
      );
      
      return patient.lifestyle;
    } catch (error) {
      logger.error('Error updating lifestyle', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Upload and attach a document to patient profile
   * @param {string} patientId - Patient ID
   * @param {Object} file - File object from multer
   * @param {Object} documentData - Document metadata
   * @param {Object} requestingUser - User uploading document
   * @returns {Promise<Object>} Document metadata
   */
  uploadDocument: async (patientId, file, documentData, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Generate secure storage path and encrypt file if necessary
      const secureFilename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const secureFilePath = path.join(config.UPLOAD_DIR, 'patient-documents', secureFilename);
      
      // Ensure directory exists
      const dir = path.dirname(secureFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // In a production environment, encrypt the file before storing
      // For simplicity, we'll just move the file here
      fs.writeFileSync(secureFilePath, fs.readFileSync(file.path));
      fs.unlinkSync(file.path); // Remove the temporary file
      
      // Create document record
      const newDocument = {
        type: documentData.type,
        title: documentData.title,
        description: documentData.description || '',
        filename: file.originalname,
        contentType: file.mimetype,
        documentPath: secureFilename, // Store reference only, not full path
        uploadDate: new Date(),
        source: documentData.source || 'Provider',
        uploadedBy: {
          user: requestingUser._id,
          date: new Date()
        }
      };
      
      // Get current documents for version tracking
      const oldDocuments = [...patient.documents];
      
      // Add new document
      patient.documents.push(newDocument);
      
      // Update metadata
      patient.lastUpdated = {
        date: new Date(),
        by: {
          user: requestingUser._id,
          role: requestingUser.role
        },
        changes: ['documents']
      };
      
      await patient.save();
      
      // We don't track the actual document content in version history,
      // just the metadata about the document
      await profileVersionService.createVersion(
        patientId,
        { documents: oldDocuments.map(d => ({ ...d.toObject(), documentPath: undefined })) },
        { documents: patient.documents.map(d => ({ ...d.toObject(), documentPath: undefined })) },
        requestingUser,
        'Added document'
      );
      
      // Return document metadata (without secure path)
      const documentMetadata = { ...newDocument };
      delete documentMetadata.documentPath;
      
      return documentMetadata;
    } catch (error) {
      logger.error('Error uploading document', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Get document file from patient profile
   * @param {string} patientId - Patient ID
   * @param {string} documentId - Document ID
   * @param {Object} requestingUser - User requesting document
   * @returns {Promise<Object>} File information
   */
  getDocument: async (patientId, documentId, requestingUser) => {
    try {
      // Include documentPath field which is normally hidden
      const patient = await Patient.findById(patientId).select('+documents.documentPath');
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Find the document
      const document = patient.documents.id(documentId);
      
      if (!document) {
        throw new NotFoundError('Document not found');
      }
      
      // Check permissions based on role
      // Implement more granular access control here if needed
      
      // Construct full file path
      const filePath = path.join(config.UPLOAD_DIR, 'patient-documents', document.documentPath);
      
      if (!fs.existsSync(filePath)) {
        throw new NotFoundError('Document file not found');
      }
      
      // In a real implementation, decrypt the file if it's encrypted
      
      return {
        filePath,
        filename: document.filename,
        contentType: document.contentType
      };
    } catch (error) {
      logger.error('Error retrieving document', {
        patientId,
        documentId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Get patient profile version history
   * @param {string} patientId - Patient ID
   * @param {Object} options - Pagination options
   * @param {Object} requestingUser - User requesting history
   * @returns {Promise<Object>} Version history
   */
  getProfileVersionHistory: async (patientId, options, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Check permissions
      if (
        requestingUser.role !== 'admin' && 
        requestingUser.role !== 'doctor' && 
        requestingUser._id.toString() !== patient.user.toString()
      ) {
        throw new AuthorizationError('Not authorized to view version history');
      }
      
      // Get version history from service
      return await profileVersionService.getVersionHistory(patientId, options);
    } catch (error) {
      logger.error('Error retrieving profile version history', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Compare two versions of a patient profile
   * @param {string} patientId - Patient ID
   * @param {number} versionA - First version number
   * @param {number} versionB - Second version number
   * @param {Object} requestingUser - User requesting comparison
   * @returns {Promise<Object>} Comparison results
   */
  compareProfileVersions: async (patientId, versionA, versionB, requestingUser) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Check permissions
      if (
        requestingUser.role !== 'admin' && 
        requestingUser.role !== 'doctor' && 
        requestingUser._id.toString() !== patient.user.toString()
      ) {
        throw new AuthorizationError('Not authorized to compare versions');
      }
      
      // Get comparison from service
      return await profileVersionService.compareVersions(patientId, versionA, versionB);
    } catch (error) {
      logger.error('Error comparing profile versions', {
        patientId,
        versionA,
        versionB,
        error: error.message
      });
      
      throw error;
    }
  }
};

module.exports = patientProfileService;
const Patient = require('../models/patient.model');
const PatientProfileVersion = require('../models/patientProfileVersion.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');
const _ = require('lodash');

/**
 * Service to handle patient profile version control
 */
const profileVersionService = {
  /**
   * Create a version record when a patient profile is updated
   * @param {string} patientId - ID of the patient
   * @param {Object} oldData - Previous patient data
   * @param {Object} newData - Updated patient data
   * @param {Object} user - User making the change
   * @param {string} reason - Reason for the change
   * @returns {Promise<Object>} Created version record
   */
  createVersion: async (patientId, oldData, newData, user, reason = '') => {
    try {
      // Fetch the patient to get current version number
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      const versionNumber = patient.currentVersion;
      
      // Calculate changes by comparing old and new data
      const changes = detectChanges(oldData, newData);
      
      if (changes.length === 0) {
        logger.info('No changes detected for versioning');
        return null; // No changes to track
      }
      
      // Create a snapshot of key fields for fast retrieval
      // This avoids having to reconstruct data from changes
      const snapshot = {
        demographics: {
          gender: newData.gender,
          dateOfBirth: newData.dateOfBirth,
          maritalStatus: newData.maritalStatus,
          ethnicity: newData.ethnicity,
          race: newData.race
        },
        contactInfo: {
          address: newData.address,
          phoneNumber: newData.phoneNumber,
          preferredContactMethod: newData.preferredContactMethod
        },
        allergies: newData.allergies,
        medications: newData.medications,
        medicalHistory: newData.medicalHistory,
        familyMedicalHistory: newData.familyMedicalHistory,
        vitalSigns: newData.vitalSigns,
        lifestyle: newData.lifestyle
      };
      
      // Create the version record
      const versionRecord = new PatientProfileVersion({
        patientId,
        versionNumber,
        changedBy: {
          user: user._id,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role
        },
        changes,
        reason,
        snapshot
      });
      
      await versionRecord.save();
      
      logger.info(`Created version ${versionNumber} for patient ${patientId}`);
      
      return versionRecord;
    } catch (error) {
      logger.error('Failed to create patient version record', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Get version history for a patient
   * @param {string} patientId - ID of the patient
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} List of version records
   */
  getVersionHistory: async (patientId, options = { page: 1, limit: 10 }) => {
    try {
      const skip = (options.page - 1) * options.limit;
      
      const versions = await PatientProfileVersion.find({ patientId })
        .sort({ versionNumber: -1 })
        .skip(skip)
        .limit(options.limit)
        .populate('changedBy.user', 'firstName lastName role');
        
      const total = await PatientProfileVersion.countDocuments({ patientId });
      
      return {
        versions,
        pagination: {
          total,
          page: options.page,
          limit: options.limit,
          pages: Math.ceil(total / options.limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get patient version history', {
        patientId,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Get a specific version of a patient profile
   * @param {string} patientId - ID of the patient
   * @param {number} versionNumber - Version number to retrieve
   * @returns {Promise<Object>} Version record with snapshot
   */
  getVersion: async (patientId, versionNumber) => {
    try {
      // Find the specific version
      const version = await PatientProfileVersion.findOne({
        patientId,
        versionNumber
      }).populate('changedBy.user', 'firstName lastName role');
      
      if (!version) {
        throw new NotFoundError(`Version ${versionNumber} not found for patient ${patientId}`);
      }
      
      return version;
    } catch (error) {
      logger.error('Failed to get specific patient version', {
        patientId,
        versionNumber,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Compare two versions of a patient profile
   * @param {string} patientId - ID of the patient
   * @param {number} versionA - First version to compare
   * @param {number} versionB - Second version to compare
   * @returns {Promise<Object>} Comparison result
   */
  compareVersions: async (patientId, versionA, versionB) => {
    try {
      // Ensure versionA < versionB for consistent results
      const [olderVersion, newerVersion] = versionA < versionB 
        ? [versionA, versionB] 
        : [versionB, versionA];
      
      // Get the two versions
      const versionARecord = await PatientProfileVersion.findOne({
        patientId,
        versionNumber: olderVersion
      });
      
      const versionBRecord = await PatientProfileVersion.findOne({
        patientId,
        versionNumber: newerVersion
      });
      
      if (!versionARecord || !versionBRecord) {
        throw new NotFoundError('One or both versions not found');
      }
      
      // Compare snapshots to get differences
      const differences = {};
      
      // Compare snapshots section by section
      for (const section in versionARecord.snapshot) {
        // Handle arrays (like allergies, medications)
        if (Array.isArray(versionARecord.snapshot[section])) {
          differences[section] = compareArrays(
            versionARecord.snapshot[section],
            versionBRecord.snapshot[section]
          );
        } 
        // Handle objects (like demographics, vitalSigns)
        else if (typeof versionARecord.snapshot[section] === 'object') {
          differences[section] = compareObjects(
            versionARecord.snapshot[section],
            versionBRecord.snapshot[section]
          );
        }
      }
      
      return {
        olderVersion,
        newerVersion,
        changedBy: versionBRecord.changedBy,
        changeDate: versionBRecord.timestamp,
        differences
      };
    } catch (error) {
      logger.error('Failed to compare patient versions', {
        patientId,
        versionA,
        versionB,
        error: error.message
      });
      
      throw error;
    }
  },
  
  /**
   * Get the complete change history for a specific field
   * @param {string} patientId - ID of the patient
   * @param {string} field - Dot notation path to the field
   * @returns {Promise<Array>} List of changes to the field
   */
  getFieldHistory: async (patientId, field) => {
    try {
      const fieldRegex = new RegExp(`^${field}(\\..*)?$`);
      
      // Find all versions with changes to this field
      const versions = await PatientProfileVersion.find({
        patientId,
        'changes.field': { $regex: fieldRegex }
      }).sort({ versionNumber: 1 });
      
      // Extract only the relevant changes
      const fieldHistory = versions.map(version => {
        const relevantChanges = version.changes.filter(change => 
          change.field.match(fieldRegex)
        );
        
        return {
          versionNumber: version.versionNumber,
          timestamp: version.timestamp,
          changedBy: version.changedBy,
          changes: relevantChanges
        };
      });
      
      return fieldHistory;
    } catch (error) {
      logger.error('Failed to get field history', {
        patientId,
        field,
        error: error.message
      });
      
      throw error;
    }
  }
};

/**
 * Detect changes between two objects 
 * @private
 * @param {Object} oldData - Old data object
 * @param {Object} newData - New data object
 * @returns {Array} List of changes
 */
function detectChanges(oldData, newData) {
  const changes = [];
  
  // Helper function to recursively detect changes
  function detect(oldObj, newObj, path = '') {
    // If both are arrays, compare arrays
    if (Array.isArray(oldObj) && Array.isArray(newObj)) {
      // For simplicity, we'll treat array changes as replacements
      // In a real app, you'd use a diffing algorithm for arrays
      if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
        changes.push({
          field: path,
          oldValue: oldObj,
          newValue: newObj,
          action: 'modify'
        });
      }
      return;
    }
    
    // If both are objects, recursively compare
    if (oldObj && newObj && typeof oldObj === 'object' && typeof newObj === 'object') {
      // Get all keys from both objects
      const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
      
      for (const key of allKeys) {
        const newPath = path ? `${path}.${key}` : key;
        
        // Key only in oldObj (deleted)
        if (!(key in newObj)) {
          changes.push({
            field: newPath,
            oldValue: oldObj[key],
            newValue: undefined,
            action: 'delete'
          });
          continue;
        }
        
        // Key only in newObj (added)
        if (!(key in oldObj)) {
          changes.push({
            field: newPath,
            oldValue: undefined,
            newValue: newObj[key],
            action: 'add'
          });
          continue;
        }
        
        // Key in both, compare values
        detect(oldObj[key], newObj[key], newPath);
      }
      return;
    }
    
    // Compare primitive values
    if (oldObj !== newObj) {
      changes.push({
        field: path,
        oldValue: oldObj,
        newValue: newObj,
        action: 'modify'
      });
    }
  }
  
  detect(oldData, newData);
  return changes;
}

/**
 * Compare two arrays and return differences
 * @private
 * @param {Array} arrayA - First array
 * @param {Array} arrayB - Second array
 * @returns {Object} Differences
 */
function compareArrays(arrayA, arrayB) {
  // This is a simplified comparison that works for simple objects
  // For complex objects, you'd need a more sophisticated algorithm
  
  // Items in B but not in A (added)
  const added = arrayB.filter(itemB => 
    !arrayA.some(itemA => _.isEqual(itemA, itemB))
  );
  
  // Items in A but not in B (removed)
  const removed = arrayA.filter(itemA => 
    !arrayB.some(itemB => _.isEqual(itemA, itemB))
  );
  
  // If either added or removed has items, there are differences
  if (added.length > 0 || removed.length > 0) {
    return {
      added,
      removed,
      hasDifferences: true
    };
  }
  
  return { hasDifferences: false };
}

/**
 * Compare two objects and return differences
 * @private
 * @param {Object} objA - First object
 * @param {Object} objB - Second object
 * @returns {Object} Differences
 */
function compareObjects(objA, objB) {
  const differences = {};
  let hasDifferences = false;
  
  // Check all keys in both objects
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);
  
  for (const key of allKeys) {
    // Handle nested objects
    if (
      objA[key] && objB[key] &&
      typeof objA[key] === 'object' && typeof objB[key] === 'object' &&
      !Array.isArray(objA[key]) && !Array.isArray(objB[key])
    ) {
      const nestedDiff = compareObjects(objA[key], objB[key]);
      
      if (nestedDiff.hasDifferences) {
        differences[key] = nestedDiff;
        hasDifferences = true;
      }
      continue;
    }
    
    // Handle arrays
    if (Array.isArray(objA[key]) && Array.isArray(objB[key])) {
      const arrayDiff = compareArrays(objA[key], objB[key]);
      
      if (arrayDiff.hasDifferences) {
        differences[key] = arrayDiff;
        hasDifferences = true;
      }
      continue;
    }
    
    // Handle primitive values
    if (!_.isEqual(objA[key], objB[key])) {
      differences[key] = {
        oldValue: objA[key],
        newValue: objB[key],
        hasDifferences: true
      };
      hasDifferences = true;
    }
  }
  
  return {
    ...differences,
    hasDifferences
  };
}

module.exports = profileVersionService;
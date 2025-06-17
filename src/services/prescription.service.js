const Prescription = require('../models/prescription.model');
const Medication = require('../models/medication.model');
const Pharmacy = require('../models/pharmacy.model');
const Patient = require('../models/patient.model');
const drugInteractionService = require('./drugInteraction.service');
const logger = require('../utils/logger');
const ApiError = require('../utils/api-error');

class PrescriptionService {
  /**
   * Create a draft prescription
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise<Object>} Created prescription
   */
  async createPrescription(prescriptionData) {
    try {
      const { patient, prescribedBy, medications, pharmacy } = prescriptionData;

      // Validate patient exists
      const patientExists = await Patient.exists({ _id: patient });
      if (!patientExists) {
        throw new ApiError(404, 'Patient not found');
      }

      // Validate pharmacy exists
      const pharmacyExists = await Pharmacy.exists({ _id: pharmacy });
      if (!pharmacyExists) {
        throw new ApiError(404, 'Pharmacy not found');
      }

      // Get medication IDs
      const medicationIds = medications.map(m => m.medication);

      // Check for drug interactions and allergies
      const { drugInteractions, allergyInteractions } = await drugInteractionService.checkAllInteractions(
        patient,
        medicationIds
      );

      // Set expiration date (default to 1 year from now)
      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);

      // Create the prescription with any detected interactions/allergies
      const prescription = new Prescription({
        ...prescriptionData,
        expirationDate,
        interactionWarnings: drugInteractions,
        allergyWarnings: allergyInteractions,
        status: 'draft',
        statusHistory: [{
          status: 'draft',
          timestamp: new Date(),
          updatedBy: prescribedBy
        }]
      });

      await prescription.save();
      return prescription;
    } catch (error) {
      logger.error(`Error creating prescription: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Get prescription by ID with populated references
   * @param {String} prescriptionId - Prescription ID
   * @returns {Promise<Object>} Prescription with populated references
   */
  async getPrescriptionById(prescriptionId) {
    try {
      const prescription = await Prescription.findById(prescriptionId)
        .populate('patient', 'firstName lastName dateOfBirth gender')
        .populate('prescribedBy', 'firstName lastName')
        .populate('pharmacy', 'name address phone')
        .populate('medications.medication')
        .populate('interactionWarnings.medicationIds')
        .populate('allergyWarnings.allergyId')
        .populate('allergyWarnings.medicationId');

      if (!prescription) {
        throw new ApiError(404, 'Prescription not found');
      }

      return prescription;
    } catch (error) {
      logger.error(`Error getting prescription: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Get prescriptions by doctor with pagination
   * @param {String} doctorId - Doctor ID
   * @param {Object} options - Pagination and filtering options
   * @returns {Promise<Object>} Paginated prescriptions
   */
  async getPrescriptionsByDoctor(doctorId, options = {}) {
    try {
      const { page = 1, limit = 10, status, startDate, endDate, patientId } = options;
      
      const query = { prescribedBy: doctorId };
      
      if (status) query.status = status;
      if (patientId) query.patient = patientId;
      
      if (startDate || endDate) {
        query.prescriptionDate = {};
        if (startDate) query.prescriptionDate.$gte = new Date(startDate);
        if (endDate) query.prescriptionDate.$lte = new Date(endDate);
      }
      
      const total = await Prescription.countDocuments(query);
      const prescriptions = await Prescription.find(query)
        .populate('patient', 'firstName lastName dateOfBirth')
        .populate('pharmacy', 'name')
        .populate('medications.medication', 'name genericName')
        .sort({ prescriptionDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      return {
        prescriptions,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        totalItems: total
      };
    } catch (error) {
      logger.error(`Error getting doctor prescriptions: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Get prescriptions by patient with pagination
   * @param {String} patientId - Patient ID
   * @param {Object} options - Pagination and filtering options
   * @returns {Promise<Object>} Paginated prescriptions
   */
  async getPrescriptionsByPatient(patientId, options = {}) {
    try {
      const { page = 1, limit = 10, status, startDate, endDate } = options;
      
      const query = { patient: patientId };
      
      if (status) query.status = status;
      
      if (startDate || endDate) {
        query.prescriptionDate = {};
        if (startDate) query.prescriptionDate.$gte = new Date(startDate);
        if (endDate) query.prescriptionDate.$lte = new Date(endDate);
      }
      
      const total = await Prescription.countDocuments(query);
      const prescriptions = await Prescription.find(query)
        .populate('prescribedBy', 'firstName lastName')
        .populate('pharmacy', 'name')
        .populate('medications.medication', 'name genericName')
        .sort({ prescriptionDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
      
      return {
        prescriptions,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        totalItems: total
      };
    } catch (error) {
      logger.error(`Error getting patient prescriptions: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Update prescription status
   * @param {String} prescriptionId - Prescription ID
   * @param {String} status - New status
   * @param {String} userId - User ID making the change
   * @param {String} notes - Optional notes for status change
   * @returns {Promise<Object>} Updated prescription
   */
  async updatePrescriptionStatus(prescriptionId, status, userId, notes) {
    try {
      const prescription = await Prescription.findById(prescriptionId);
      
      if (!prescription) {
        throw new ApiError(404, 'Prescription not found');
      }

      // Add to status history
      prescription.statusHistory.push({
        status,
        timestamp: new Date(),
        updatedBy: userId,
        notes: notes || undefined
      });
      
      // Update current status
      prescription.status = status;
      
      await prescription.save();
      return prescription;
    } catch (error) {
      logger.error(`Error updating prescription status: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Sign a prescription with digital signature
   * @param {String} prescriptionId - Prescription ID
   * @param {String} signature - Digital signature data
   * @param {String} userId - Doctor's user ID
   * @returns {Promise<Object>} Updated prescription
   */
  async signPrescription(prescriptionId, signature, userId) {
    try {
      const prescription = await Prescription.findById(prescriptionId);
      
      if (!prescription) {
        throw new ApiError(404, 'Prescription not found');
      }
      
      // Verify that the user is the prescriber
      if (prescription.prescribedBy.toString() !== userId) {
        throw new ApiError(403, 'Only the prescriber can sign this prescription');
      }
      
      // Check if there are any contraindicated warnings that haven't been overridden
      const hasContraindicatedWarnings = [
        ...prescription.interactionWarnings,
        ...prescription.allergyWarnings
      ].some(warning => 
        warning.severity === 'contraindicated' && !warning.overrideReason
      );
      
      if (hasContraindicatedWarnings) {
        throw new ApiError(400, 'Cannot sign prescription with unaddressed contraindicated warnings');
      }
      
      // Sign the prescription
      prescription.digitalSignature = {
        data: signature,
        timestamp: new Date()
      };
      
      // Update status to pending (ready for transmission)
      prescription.status = 'pending';
      prescription.statusHistory.push({
        status: 'pending',
        timestamp: new Date(),
        updatedBy: userId,
        notes: 'Prescription signed'
      });
      
      await prescription.save();
      return prescription;
    } catch (error) {
      logger.error(`Error signing prescription: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }

  /**
   * Electronically transmit prescription to pharmacy
   * @param {String} prescriptionId - Prescription ID
   * @param {String} method - Transmission method
   * @param {String} userId - User ID making the transmission
   * @returns {Promise<Object>} Updated prescription
   */
  async transmitPrescription(prescriptionId, method, userId) {
    try {
      const prescription = await Prescription.findById(prescriptionId)
        .populate('pharmacy');
      
      if (!prescription) {
        throw new ApiError(404, 'Prescription not found');
      }
      
      // Ensure prescription is signed
      if (!prescription.digitalSignature || !prescription.digitalSignature.data) {
        throw new ApiError(400, 'Prescription must be signed before transmission');
      }
      
      // Simulate electronic transmission to pharmacy
      // In a real system, this would integrate with pharmacy systems
      const transmissionDetails = {
        sentAt: new Date(),
        receivedAt: null, // Would be set when confirmation received from pharmacy
        confirmationCode: `TX-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        transmissionErrors: []
      };
      
      // Update prescription with transmission details
      prescription.transmissionMethod = method;
      prescription.transmissionDetails = transmissionDetails;
      
      // Update status to active
      prescription.status = 'active';
      prescription.statusHistory.push({
        status: 'active',
        timestamp: new Date(),
        updatedBy: userId,
        notes: `Transmitted via ${method} to ${prescription.pharmacy.name}`
      });
      
      await prescription.save();
      return prescription;
    } catch (error) {
      logger.error(`Error transmitting prescription: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
  
  /**
   * Override interaction or allergy warning
   * @param {String} prescriptionId - Prescription ID
   * @param {String} warningType - Type of warning ('interaction' or 'allergy')
   * @param {String} warningId - ID of the warning in the array
   * @param {String} overrideReason - Reason for override
   * @param {String} userId - User ID making the override
   * @returns {Promise<Object>} Updated prescription
   */
  async overrideWarning(prescriptionId, warningType, warningId, overrideReason, userId) {
    try {
      const prescription = await Prescription.findById(prescriptionId);
      
      if (!prescription) {
        throw new ApiError(404, 'Prescription not found');
      }
      
      // Find the warning to override
      const warningArray = warningType === 'interaction' ? 
        'interactionWarnings' : 'allergyWarnings';
      
      const warningIndex = prescription[warningArray].findIndex(
        w => w._id.toString() === warningId
      );
      
      if (warningIndex === -1) {
        throw new ApiError(404, 'Warning not found');
      }
      
      // Apply the override
      prescription[warningArray][warningIndex].overrideReason = overrideReason;
      prescription[warningArray][warningIndex].overriddenAt = new Date();
      prescription[warningArray][warningIndex].overriddenBy = userId;
      
      await prescription.save();
      return prescription;
    } catch (error) {
      logger.error(`Error overriding warning: ${error.message}`, { stack: error.stack });
      throw error;
    }
  }
}

module.exports = new PrescriptionService();
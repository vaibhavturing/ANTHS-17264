const { InsurancePlan, InsuranceProvider, PatientInsurance } = require('../models/insurance.model');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const axios = require('axios');
const { ValidationError } = require('../utils/errors');

/**
 * Service for managing insurance-related operations
 */
const insuranceService = {
  /**
   * Create a new insurance provider
   * @param {Object} providerData - Provider data to create
   * @returns {Promise<Object>} Created insurance provider
   */
  createInsuranceProvider: async (providerData) => {
    try {
      logger.info('Creating new insurance provider');
      
      const insuranceProvider = new InsuranceProvider(providerData);
      await insuranceProvider.save();
      
      logger.info(`Insurance provider created: ${insuranceProvider._id}`);
      return insuranceProvider;
    } catch (error) {
      logger.error('Failed to create insurance provider', { error: error.message });
      throw error;
    }
  },

  /**
   * Get all insurance providers
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of insurance providers
   */
  getInsuranceProviders: async (filters = {}) => {
    try {
      const query = { ...filters };
      
      if (!query.hasOwnProperty('isActive')) {
        query.isActive = true;
      }
      
      const providers = await InsuranceProvider.find(query);
      return providers;
    } catch (error) {
      logger.error('Failed to get insurance providers', { error: error.message });
      throw error;
    }
  },

  /**
   * Get insurance provider by ID
   * @param {string} providerId - Provider ID
   * @returns {Promise<Object>} Insurance provider
   */
  getInsuranceProviderById: async (providerId) => {
    try {
      const provider = await InsuranceProvider.findById(providerId);
      
      if (!provider) {
        throw new Error('Insurance provider not found');
      }
      
      return provider;
    } catch (error) {
      logger.error('Failed to get insurance provider', { error: error.message, providerId });
      throw error;
    }
  },

  /**
   * Update insurance provider
   * @param {string} providerId - Provider ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated insurance provider
   */
  updateInsuranceProvider: async (providerId, updateData) => {
    try {
      const provider = await InsuranceProvider.findByIdAndUpdate(
        providerId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!provider) {
        throw new Error('Insurance provider not found');
      }
      
      logger.info(`Insurance provider updated: ${providerId}`);
      return provider;
    } catch (error) {
      logger.error('Failed to update insurance provider', { error: error.message, providerId });
      throw error;
    }
  },

  /**
   * Create a new insurance plan
   * @param {Object} planData - Plan data to create
   * @returns {Promise<Object>} Created insurance plan
   */
  createInsurancePlan: async (planData) => {
    try {
      logger.info('Creating new insurance plan');
      
      // Verify provider exists
      const providerExists = await InsuranceProvider.exists({ _id: planData.providerId });
      if (!providerExists) {
        throw new ValidationError('Insurance provider does not exist');
      }
      
      const insurancePlan = new InsurancePlan(planData);
      await insurancePlan.save();
      
      logger.info(`Insurance plan created: ${insurancePlan._id}`);
      return insurancePlan;
    } catch (error) {
      logger.error('Failed to create insurance plan', { error: error.message });
      throw error;
    }
  },

  /**
   * Get all insurance plans
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of insurance plans
   */
  getInsurancePlans: async (filters = {}) => {
    try {
      const query = { ...filters };
      
      if (!query.hasOwnProperty('isActive')) {
        query.isActive = true;
      }
      
      const plans = await InsurancePlan.find(query)
        .populate('providerId', 'name contactPhone contactEmail');
      
      return plans;
    } catch (error) {
      logger.error('Failed to get insurance plans', { error: error.message });
      throw error;
    }
  },

  /**
   * Get insurance plan by ID
   * @param {string} planId - Plan ID
   * @returns {Promise<Object>} Insurance plan
   */
  getInsurancePlanById: async (planId) => {
    try {
      const plan = await InsurancePlan.findById(planId)
        .populate('providerId', 'name contactPhone contactEmail');
      
      if (!plan) {
        throw new Error('Insurance plan not found');
      }
      
      return plan;
    } catch (error) {
      logger.error('Failed to get insurance plan', { error: error.message, planId });
      throw error;
    }
  },

  /**
   * Update insurance plan
   * @param {string} planId - Plan ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated insurance plan
   */
  updateInsurancePlan: async (planId, updateData) => {
    try {
      const plan = await InsurancePlan.findByIdAndUpdate(
        planId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!plan) {
        throw new Error('Insurance plan not found');
      }
      
      logger.info(`Insurance plan updated: ${planId}`);
      return plan;
    } catch (error) {
      logger.error('Failed to update insurance plan', { error: error.message, planId });
      throw error;
    }
  },

  /**
   * Add insurance information to a patient
   * @param {Object} insuranceData - Patient insurance data
   * @returns {Promise<Object>} Created patient insurance record
   */
  addPatientInsurance: async (insuranceData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // If this is marked as primary, update any existing primary insurance to not be primary
      if (insuranceData.isPrimary) {
        await PatientInsurance.updateMany(
          { patientId: insuranceData.patientId, isPrimary: true },
          { $set: { isPrimary: false } },
          { session }
        );
      }
      
      const patientInsurance = new PatientInsurance(insuranceData);
      await patientInsurance.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`Patient insurance added: ${patientInsurance._id}`);
      return patientInsurance;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Failed to add patient insurance', { error: error.message });
      throw error;
    }
  },

  /**
   * Get patient insurance records
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} List of patient insurance records
   */
  getPatientInsurances: async (patientId) => {
    try {
      const insurances = await PatientInsurance.find({ patientId, isActive: true })
        .populate('providerId', 'name contactPhone contactEmail')
        .populate('planId', 'planName planType deductible coPayAmount coveragePercentage');
      
      return insurances;
    } catch (error) {
      logger.error('Failed to get patient insurances', { error: error.message, patientId });
      throw error;
    }
  },

  /**
   * Get patient insurance by ID
   * @param {string} insuranceId - Insurance record ID
   * @returns {Promise<Object>} Patient insurance record
   */
  getPatientInsuranceById: async (insuranceId) => {
    try {
      const insurance = await PatientInsurance.findById(insuranceId)
        .populate('providerId', 'name contactPhone contactEmail verificationEndpoint')
        .populate('planId', 'planName planType deductible coPayAmount coveragePercentage');
      
      if (!insurance) {
        throw new Error('Patient insurance record not found');
      }
      
      return insurance;
    } catch (error) {
      logger.error('Failed to get patient insurance', { error: error.message, insuranceId });
      throw error;
    }
  },

  /**
   * Update patient insurance
   * @param {string} insuranceId - Insurance record ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated patient insurance record
   */
  updatePatientInsurance: async (insuranceId, updateData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // If updating to primary, update other insurances to not be primary
      if (updateData.isPrimary) {
        const insurance = await PatientInsurance.findById(insuranceId);
        if (!insurance) {
          throw new Error('Patient insurance record not found');
        }
        
        await PatientInsurance.updateMany(
          { patientId: insurance.patientId, _id: { $ne: insuranceId }, isPrimary: true },
          { $set: { isPrimary: false } },
          { session }
        );
      }
      
      const updatedInsurance = await PatientInsurance.findByIdAndUpdate(
        insuranceId,
        updateData,
        { new: true, runValidators: true, session }
      );
      
      if (!updatedInsurance) {
        throw new Error('Patient insurance record not found');
      }
      
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`Patient insurance updated: ${insuranceId}`);
      return updatedInsurance;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Failed to update patient insurance', { error: error.message, insuranceId });
      throw error;
    }
  },

  /**
   * Verify insurance information
   * @param {string} patientInsuranceId - Patient insurance ID to verify
   * @returns {Promise<Object>} Verification result
   */
  verifyInsurance: async (patientInsuranceId) => {
    try {
      // Get the insurance record with provider information
      const insurance = await PatientInsurance.findById(patientInsuranceId)
        .populate('providerId', 'name verificationEndpoint')
        .populate('planId');
      
      if (!insurance) {
        throw new Error('Patient insurance record not found');
      }
      
      let verificationResult;
      
      // If provider has a verification endpoint, use it
      if (insurance.providerId && insurance.providerId.verificationEndpoint) {
        try {
          logger.info(`Verifying insurance with provider API: ${insurance.providerId.name}`);
          // In a real application, you would make an API call to the insurance provider
          // This is a mock example
          const response = await axios.post(insurance.providerId.verificationEndpoint, {
            memberNumber: insurance.memberNumber,
            groupNumber: insurance.groupNumber,
            providerName: insurance.providerId.name
          });
          
          verificationResult = response.data;
        } catch (apiError) {
          logger.error('API verification failed, using internal verification', { error: apiError.message });
          // Fall back to internal verification logic
          verificationResult = await performInternalVerification(insurance);
        }
      } else {
        // No provider API, use internal verification logic
        logger.info('Using internal verification for insurance');
        verificationResult = await performInternalVerification(insurance);
      }
      
      // Update insurance record with verification results
      const updatedInsurance = await PatientInsurance.findByIdAndUpdate(
        patientInsuranceId,
        {
          verificationStatus: verificationResult.isVerified ? 'verified' : 'failed',
          verificationDate: Date.now(),
          verificationDetails: verificationResult
        },
        { new: true }
      );
      
      logger.info(`Insurance verification completed for: ${patientInsuranceId}`);
      return {
        isVerified: verificationResult.isVerified,
        details: verificationResult,
        insurance: updatedInsurance
      };
    } catch (error) {
      logger.error('Failed to verify insurance', { error: error.message, patientInsuranceId });
      throw error;
    }
  }
};

/**
 * Perform internal insurance verification (mock implementation)
 * @param {Object} insurance - Insurance record to verify
 * @returns {Promise<Object>} Verification result
 */
async function performInternalVerification(insurance) {
  // In a real application, this would have more sophisticated logic
  // This is a simplified mock implementation
  
  try {
    // Check if insurance is currently active
    const isActive = insurance.isActive;
    const isExpired = insurance.expirationDate && new Date(insurance.expirationDate) < new Date();
    
    // Basic verification checks
    const checks = {
      isActive,
      hasValidDates: !isExpired,
      hasValidMemberNumber: Boolean(insurance.memberNumber && insurance.memberNumber.length > 5),
      hasValidPlan: Boolean(insurance.planId)
    };
    
    // Overall verification result
    const isVerified = checks.isActive && checks.hasValidDates && 
                       checks.hasValidMemberNumber && checks.hasValidPlan;
    
    // Mock coverage information based on the plan
    let coverageInfo = {};
    if (insurance.planId) {
      coverageInfo = {
        deductible: insurance.planId.deductible,
        coPayAmount: insurance.planId.coPayAmount,
        coveragePercentage: insurance.planId.coveragePercentage,
        planType: insurance.planId.planType
      };
    }
    
    return {
      isVerified,
      checks,
      coverageInfo,
      message: isVerified 
        ? 'Insurance verification successful' 
        : 'Insurance could not be fully verified',
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Internal verification logic failed', { error: error.message });
    return {
      isVerified: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

module.exports = insuranceService;
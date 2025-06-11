const { Billing, InsuranceClaim, Payment, PaymentPlan } = require('../models/billing.model');
const { PatientInsurance } = require('../models/insurance.model');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Service for managing billing-related operations
 */
const billingService = {
  /**
   * Create a new billing record
   * @param {Object} billingData - Billing data to create
   * @returns {Promise<Object>} Created billing record
   */
  createBilling: async (billingData) => {
    try {
      logger.info('Creating new billing record');
      
      const billing = new Billing(billingData);
      await billing.save();
      
      logger.info(`Billing record created: ${billing._id}`);
      return billing;
    } catch (error) {
      logger.error('Failed to create billing record', { error: error.message });
      throw error;
    }
  },

  /**
   * Get all billing records with optional filtering
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of billing records
   */
  getBillings: async (filters = {}) => {
    try {
      const query = { ...filters };
      
      const billings = await Billing.find(query)
        .populate('patientId', 'firstName lastName email')
        .populate('appointmentId')
        .populate('insuranceId')
        .sort({ billingDate: -1 });
      
      return billings;
    } catch (error) {
      logger.error('Failed to get billing records', { error: error.message });
      throw error;
    }
  },

  /**
   * Get a billing record by ID
   * @param {string} billingId - Billing ID
   * @returns {Promise<Object>} Billing record
   */
  getBillingById: async (billingId) => {
    try {
      const billing = await Billing.findById(billingId)
        .populate('patientId', 'firstName lastName email')
        .populate('appointmentId')
        .populate({
          path: 'insuranceId',
          populate: [
            { path: 'providerId', select: 'name contactPhone' },
            { path: 'planId', select: 'planName deductible coPayAmount coveragePercentage' }
          ]
        });
      
      if (!billing) {
        throw new NotFoundError('Billing record not found');
      }
      
      return billing;
    } catch (error) {
      logger.error('Failed to get billing record', { error: error.message, billingId });
      throw error;
    }
  },

  /**
   * Update a billing record
   * @param {string} billingId - Billing ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated billing record
   */
  updateBilling: async (billingId, updateData) => {
    try {
      const billing = await Billing.findByIdAndUpdate(
        billingId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!billing) {
        throw new NotFoundError('Billing record not found');
      }
      
      logger.info(`Billing record updated: ${billingId}`);
      return billing;
    } catch (error) {
      logger.error('Failed to update billing record', { error: error.message, billingId });
      throw error;
    }
  },

  /**
   * Delete a billing record
   * @param {string} billingId - Billing ID
   * @returns {Promise<Object>} Deletion result
   */
  deleteBilling: async (billingId) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Check if billing exists
      const billing = await Billing.findById(billingId);
      if (!billing) {
        throw new NotFoundError('Billing record not found');
      }
      
      // Check for related claims
      const hasClaims = await InsuranceClaim.exists({ billingId });
      if (hasClaims) {
        throw new ValidationError('Cannot delete billing record with associated insurance claims');
      }
      
      // Check for related payments
      const hasPayments = await Payment.exists({ billingId });
      if (hasPayments) {
        throw new ValidationError('Cannot delete billing record with associated payments');
      }
      
      // Check if part of a payment plan
      const hasPaymentPlan = await PaymentPlan.exists({ billingIds: billingId });
      if (hasPaymentPlan) {
        throw new ValidationError('Cannot delete billing record that is part of a payment plan');
      }
      
      // Delete the billing record
      const result = await Billing.findByIdAndDelete(billingId, { session });
      
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`Billing record deleted: ${billingId}`);
      return { success: true, message: 'Billing record deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Failed to delete billing record', { error: error.message, billingId });
      throw error;
    }
  },

  /**
   * Get billing history for a patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} Billing history
   */
  getPatientBillingHistory: async (patientId) => {
    try {
      const billings = await Billing.find({ patientId })
        .populate('appointmentId')
        .populate('insuranceId')
        .sort({ billingDate: -1 });
      
      return billings;
    } catch (error) {
      logger.error('Failed to get patient billing history', { error: error.message, patientId });
      throw error;
    }
  },

  /**
   * Get outstanding balance for a patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Outstanding balance information
   */
  getPatientOutstandingBalance: async (patientId) => {
    try {
      // Get all billing records that are not fully paid
      const outstandingBillings = await Billing.find({
        patientId,
        billStatus: { $in: ['draft', 'pending', 'submitted', 'partially_paid', 'overdue'] }
      });
      
      // Calculate total outstanding amount
      let totalOutstanding = 0;
      let overdueBillings = 0;
      let currentBillings = 0;
      
      const today = new Date();
      
      for (const billing of outstandingBillings) {
        totalOutstanding += billing.patientResponsibility;
        
        if (billing.billStatus === 'overdue' || new Date(billing.dueDate) < today) {
          overdueBillings++;
        } else {
          currentBillings++;
        }
      }
      
      // Get payment plans
      const paymentPlans = await PaymentPlan.find({
        patientId,
        status: 'active'
      });
      
      return {
        totalOutstandingBalance: totalOutstanding,
        outstandingBillingsCount: outstandingBillings.length,
        overdueBillingsCount: overdueBillings,
        currentBillingsCount: currentBillings,
        activePaymentPlans: paymentPlans.length,
        hasOverduePayments: overdueBillings > 0
      };
    } catch (error) {
      logger.error('Failed to get patient outstanding balance', { error: error.message, patientId });
      throw error;
    }
  },

  /**
   * Create an insurance claim
   * @param {Object} claimData - Claim data
   * @returns {Promise<Object>} Created claim
   */
  createInsuranceClaim: async (claimData) => {
    try {
      logger.info('Creating new insurance claim');
      
      const claim = new InsuranceClaim(claimData);
      await claim.save();
      
      // Update billing status to submitted
      await Billing.findByIdAndUpdate(
        claimData.billingId,
        { billStatus: 'submitted' }
      );
      
      logger.info(`Insurance claim created: ${claim._id}`);
      return claim;
    } catch (error) {
      logger.error('Failed to create insurance claim', { error: error.message });
      throw error;
    }
  },

  /**
   * Get all insurance claims
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of insurance claims
   */
  getInsuranceClaims: async (filters = {}) => {
    try {
      const query = { ...filters };
      
      const claims = await InsuranceClaim.find(query)
        .populate('patientId', 'firstName lastName')
        .populate('patientInsuranceId')
        .populate('providerId', 'name')
        .populate('billingId')
        .sort({ claimDate: -1 });
      
      return claims;
    } catch (error) {
      logger.error('Failed to get insurance claims', { error: error.message });
      throw error;
    }
  },

  /**
   * Get insurance claim by ID
   * @param {string} claimId - Claim ID
   * @returns {Promise<Object>} Insurance claim
   */
  getInsuranceClaimById: async (claimId) => {
    try {
      const claim = await InsuranceClaim.findById(claimId)
        .populate('patientId', 'firstName lastName')
        .populate({
          path: 'patientInsuranceId',
          populate: [
            { path: 'providerId', select: 'name contactPhone' },
            { path: 'planId', select: 'planName planType' }
          ]
        })
        .populate('providerId', 'name contactPhone contactEmail')
        .populate('billingId');
      
      if (!claim) {
        throw new NotFoundError('Insurance claim not found');
      }
      
      return claim;
    } catch (error) {
      logger.error('Failed to get insurance claim', { error: error.message, claimId });
      throw error;
    }
  },

  /**
   * Update insurance claim
   * @param {string} claimId - Claim ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated claim
   */
  updateInsuranceClaim: async (claimId, updateData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const claim = await InsuranceClaim.findByIdAndUpdate(
        claimId,
        updateData,
        { new: true, runValidators: true, session }
      );
      
      if (!claim) {
        throw new NotFoundError('Insurance claim not found');
      }
      
      // If claim status is approved or partially approved, update the billing
      if (updateData.claimStatus === 'approved' || updateData.claimStatus === 'partially_approved') {
        const billing = await Billing.findById(claim.billingId);
        
        if (billing) {
          const insuranceCoverage = updateData.approvedAmount || 0;
          const newPatientResponsibility = Math.max(0, billing.totalAmount - insuranceCoverage);
          
          await Billing.findByIdAndUpdate(
            claim.billingId,
            {
              insuranceCoverage,
              patientResponsibility: newPatientResponsibility,
              billStatus: insuranceCoverage >= billing.totalAmount ? 'paid' : 'partially_paid'
            },
            { session }
          );
          
          // If insurance fully covered the bill, create a payment record from insurance
          if (insuranceCoverage >= billing.totalAmount) {
            const payment = new Payment({
              billingId: claim.billingId,
              amount: insuranceCoverage,
              paymentMethod: 'insurance',
              paymentDate: new Date(),
              paymentSource: 'insurance',
              paymentStatus: 'completed',
              notes: `Insurance payment for claim ${claim._id}`
            });
            
            await payment.save({ session });
          }
        }
      }
      
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`Insurance claim updated: ${claimId}`);
      return claim;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Failed to update insurance claim', { error: error.message, claimId });
      throw error;
    }
  },

  /**
   * Create a payment
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Created payment
   */
  createPayment: async (paymentData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.info('Creating new payment');
      
      const payment = new Payment(paymentData);
      await payment.save({ session });
      
      // Update billing record based on payment
      const billing = await Billing.findById(paymentData.billingId);
      
      if (!billing) {
        throw new NotFoundError('Billing record not found');
      }
      
      // Calculate total payment amount for this billing
      const existingPayments = await Payment.find({
        billingId: paymentData.billingId,
        paymentStatus: 'completed'
      });
      
      const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0) + paymentData.amount;
      
      // Update billing status based on total paid amount
      let newStatus;
      if (totalPaid >= billing.patientResponsibility) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        newStatus = billing.billStatus;
      }
      
      await Billing.findByIdAndUpdate(
        paymentData.billingId,
        { billStatus: newStatus },
        { session }
      );
      
      // If this billing is part of a payment plan, update the plan
      const paymentPlans = await PaymentPlan.find({
        billingIds: paymentData.billingId,
        status: 'active'
      });
      
      for (const plan of paymentPlans) {
        const planBillings = await Billing.find({
          _id: { $in: plan.billingIds }
        });
        
        // Calculate remaining balance
        const plannedTotal = planBillings.reduce((sum, b) => sum + b.patientResponsibility, 0);
        const planPaidAmount = await calculatePaidAmountForBillings(plan.billingIds);
        const newRemainingBalance = Math.max(0, plannedTotal - planPaidAmount);
        
        // Update payment plan
        const updateData = {
          remainingBalance: newRemainingBalance
        };
        
        // If plan is fully paid, mark as completed
        if (newRemainingBalance === 0) {
          updateData.status = 'completed';
        }
        
        await PaymentPlan.findByIdAndUpdate(
          plan._id,
          updateData,
          { session }
        );
      }
      
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`Payment created: ${payment._id}`);
      return payment;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Failed to create payment', { error: error.message });
      throw error;
    }
  },

  /**
   * Get payments for a specific billing
   * @param {string} billingId - Billing ID
   * @returns {Promise<Array>} List of payments
   */
  getPaymentsByBilling: async (billingId) => {
    try {
      const payments = await Payment.find({ billingId })
        .sort({ paymentDate: -1 });
      
      return payments;
    } catch (error) {
      logger.error('Failed to get payments by billing', { error: error.message, billingId });
      throw error;
    }
  },

  /**
   * Get payments for a patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} List of payments
   */
  getPaymentsByPatient: async (patientId) => {
    try {
      // Get all billings for this patient
      const billings = await Billing.find({ patientId }).select('_id');
      const billingIds = billings.map(b => b._id);
      
      // Get all payments for these billings
      const payments = await Payment.find({
        billingId: { $in: billingIds }
      })
        .populate('billingId', 'description billingDate totalAmount')
        .sort({ paymentDate: -1 });
      
      return payments;
    } catch (error) {
      logger.error('Failed to get payments by patient', { error: error.message, patientId });
      throw error;
    }
  },

  /**
   * Create a payment plan
   * @param {Object} planData - Payment plan data
   * @returns {Promise<Object>} Created payment plan
   */
  createPaymentPlan: async (planData) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.info('Creating new payment plan');
      
      // Verify all billing IDs exist and belong to this patient
      for (const billingId of planData.billingIds) {
        const billing = await Billing.findById(billingId);
        
        if (!billing) {
          throw new NotFoundError(`Billing record not found: ${billingId}`);
        }
        
        if (billing.patientId.toString() !== planData.patientId.toString()) {
          throw new ValidationError(`Billing ${billingId} does not belong to this patient`);
        }
        
        // Check if billing is already in an active plan
        const existingPlan = await PaymentPlan.findOne({
          billingIds: billingId,
          status: 'active'
        });
        
        if (existingPlan) {
          throw new ValidationError(`Billing ${billingId} is already in an active payment plan`);
        }
      }
      
      // Create the payment plan
      const paymentPlan = new PaymentPlan(planData);
      await paymentPlan.save({ session });
      
      // Update billing records to reflect they're in a payment plan
      for (const billingId of planData.billingIds) {
        await Billing.findByIdAndUpdate(
          billingId,
          { paymentPlanId: paymentPlan._id },
          { session }
        );
      }
      
      await session.commitTransaction();
      session.endSession();
      
      logger.info(`Payment plan created: ${paymentPlan._id}`);
      return paymentPlan;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Failed to create payment plan', { error: error.message });
      throw error;
    }
  },

  /**
   * Get payment plans for a patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} List of payment plans
   */
  getPatientPaymentPlans: async (patientId) => {
    try {
      const plans = await PaymentPlan.find({ patientId })
        .sort({ startDate: -1 });
      
      return plans;
    } catch (error) {
      logger.error('Failed to get patient payment plans', { error: error.message, patientId });
      throw error;
    }
  },

  /**
   * Get payment plan by ID
   * @param {string} planId - Payment plan ID
   * @returns {Promise<Object>} Payment plan
   */
  getPaymentPlanById: async (planId) => {
    try {
      const plan = await PaymentPlan.findById(planId)
        .populate('patientId', 'firstName lastName')
        .populate('billingIds', 'description billingDate totalAmount');
      
      if (!plan) {
        throw new NotFoundError('Payment plan not found');
      }
      
      return plan;
    } catch (error) {
      logger.error('Failed to get payment plan', { error: error.message, planId });
      throw error;
    }
  },

  /**
   * Update payment plan
   * @param {string} planId - Payment plan ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated payment plan
   */
  updatePaymentPlan: async (planId, updateData) => {
    try {
      const plan = await PaymentPlan.findByIdAndUpdate(
        planId,
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!plan) {
        throw new NotFoundError('Payment plan not found');
      }
      
      logger.info(`Payment plan updated: ${planId}`);
      return plan;
    } catch (error) {
      logger.error('Failed to update payment plan', { error: error.message, planId });
      throw error;
    }
  }
};

/**
 * Calculate total paid amount for a list of billing IDs
 * @param {Array} billingIds - List of billing IDs
 * @returns {Promise<number>} Total paid amount
 */
async function calculatePaidAmountForBillings(billingIds) {
  try {
    const payments = await Payment.find({
      billingId: { $in: billingIds },
      paymentStatus: 'completed'
    });
    
    return payments.reduce((sum, payment) => sum + payment.amount, 0);
  } catch (error) {
    logger.error('Failed to calculate paid amount', { error: error.message });
    throw error;
  }
}

module.exports = billingService;
const asyncHandler = require('../utils/async-handler.util');
const { ResponseUtil } = require('../utils/response.util');
const billingService = require('../services/billing.service');
const billingValidators = require('../validators/billing.validator');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Controller for managing billing-related endpoints
 */
const billingController = {
  // Billing endpoints
  createBilling: asyncHandler(async (req, res) => {
    const { error, value } = billingValidators.validateBilling.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const billing = await billingService.createBilling(value);
    
    return ResponseUtil.success(res, {
      message: 'Billing record created successfully',
      billing
    }, 201);
  }),

  getBillings: asyncHandler(async (req, res) => {
    const filters = {};
    
    // Apply filters if provided
    if (req.query.patientId) {
      filters.patientId = req.query.patientId;
    }
    
    if (req.query.billStatus) {
      filters.billStatus = req.query.billStatus;
    }
    
    if (req.query.startDate && req.query.endDate) {
      filters.billingDate = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    const billings = await billingService.getBillings(filters);
    
    return ResponseUtil.success(res, {
      count: billings.length,
      billings
    });
  }),

  getBillingById: asyncHandler(async (req, res) => {
    const billing = await billingService.getBillingById(req.params.id);
    
    return ResponseUtil.success(res, { billing });
  }),

  updateBilling: asyncHandler(async (req, res) => {
    const { error, value } = billingValidators.validateBilling.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const billing = await billingService.updateBilling(req.params.id, value);
    
    return ResponseUtil.success(res, {
      message: 'Billing record updated successfully',
      billing
    });
  }),

  deleteBilling: asyncHandler(async (req, res) => {
    const result = await billingService.deleteBilling(req.params.id);
    
    return ResponseUtil.success(res, {
      message: result.message
    });
  }),

  getPatientBillingHistory: asyncHandler(async (req, res) => {
    const billings = await billingService.getPatientBillingHistory(req.params.patientId);
    
    return ResponseUtil.success(res, {
      count: billings.length,
      billings
    });
  }),

  getPatientOutstandingBalance: asyncHandler(async (req, res) => {
    const balance = await billingService.getPatientOutstandingBalance(req.params.patientId);
    
    return ResponseUtil.success(res, { balance });
  }),

  // Insurance claim endpoints
  createInsuranceClaim: asyncHandler(async (req, res) => {
    const { error, value } = billingValidators.validateInsuranceClaim.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const claim = await billingService.createInsuranceClaim(value);
    
    return ResponseUtil.success(res, {
      message: 'Insurance claim created successfully',
      claim
    }, 201);
  }),

  getInsuranceClaims: asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.query.patientId) {
      filters.patientId = req.query.patientId;
    }
    
    if (req.query.providerId) {
      filters.providerId = req.query.providerId;
    }
    
    if (req.query.claimStatus) {
      filters.claimStatus = req.query.claimStatus;
    }
    
    const claims = await billingService.getInsuranceClaims(filters);
    
    return ResponseUtil.success(res, {
      count: claims.length,
      claims
    });
  }),

  getInsuranceClaimById: asyncHandler(async (req, res) => {
    const claim = await billingService.getInsuranceClaimById(req.params.id);
    
    return ResponseUtil.success(res, { claim });
  }),

  updateInsuranceClaim: asyncHandler(async (req, res) => {
    const { error, value } = billingValidators.validateInsuranceClaim.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const claim = await billingService.updateInsuranceClaim(req.params.id, value);
    
    return ResponseUtil.success(res, {
      message: 'Insurance claim updated successfully',
      claim
    });
  }),

  // Payment endpoints
  createPayment: asyncHandler(async (req, res) => {
    const { error, value } = billingValidators.validatePayment.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const payment = await billingService.createPayment(value);
    
    return ResponseUtil.success(res, {
      message: 'Payment processed successfully',
      payment
    }, 201);
  }),

  getPaymentsByBilling: asyncHandler(async (req, res) => {
    const payments = await billingService.getPaymentsByBilling(req.params.billingId);
    
    return ResponseUtil.success(res, {
      count: payments.length,
      payments
    });
  }),

  getPaymentsByPatient: asyncHandler(async (req, res) => {
    const payments = await billingService.getPaymentsByPatient(req.params.patientId);
    
    return ResponseUtil.success(res, {
      count: payments.length,
      payments
    });
  }),

  // Payment plan endpoints
  createPaymentPlan: asyncHandler(async (req, res) => {
    const { error, value } = billingValidators.validatePaymentPlan.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const paymentPlan = await billingService.createPaymentPlan(value);
    
    return ResponseUtil.success(res, {
      message: 'Payment plan created successfully',
      paymentPlan
    }, 201);
  }),

  getPatientPaymentPlans: asyncHandler(async (req, res) => {
    const plans = await billingService.getPatientPaymentPlans(req.params.patientId);
    
    return ResponseUtil.success(res, {
      count: plans.length,
      plans
    });
  }),

  getPaymentPlanById: asyncHandler(async (req, res) => {
    const plan = await billingService.getPaymentPlanById(req.params.id);
    
    return ResponseUtil.success(res, { plan });
  }),

  updatePaymentPlan: asyncHandler(async (req, res) => {
    const { error, value } = billingValidators.validatePaymentPlan.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const plan = await billingService.updatePaymentPlan(req.params.id, value);
    
    return ResponseUtil.success(res, {
      message: 'Payment plan updated successfully',
      plan
    });
  })
};

module.exports = billingController;
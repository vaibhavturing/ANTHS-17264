const asyncHandler = require('../utils/async-handler.util');
const { ResponseUtil } = require('../utils/response.util');
const insuranceService = require('../services/insurance.service');
const insuranceValidators = require('../validators/insurance.validator');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Controller for managing insurance-related endpoints
 */
const insuranceController = {
  // Insurance Provider endpoints
  createInsuranceProvider: asyncHandler(async (req, res) => {
    const { error, value } = insuranceValidators.validateInsuranceProvider.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const provider = await insuranceService.createInsuranceProvider(value);
    
    return ResponseUtil.success(res, {
      message: 'Insurance provider created successfully',
      provider
    }, 201);
  }),

  getInsuranceProviders: asyncHandler(async (req, res) => {
    const providers = await insuranceService.getInsuranceProviders();
    
    return ResponseUtil.success(res, {
      count: providers.length,
      providers
    });
  }),

  getInsuranceProviderById: asyncHandler(async (req, res) => {
    const provider = await insuranceService.getInsuranceProviderById(req.params.id);
    
    return ResponseUtil.success(res, { provider });
  }),

  updateInsuranceProvider: asyncHandler(async (req, res) => {
    const { error, value } = insuranceValidators.validateInsuranceProvider.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const provider = await insuranceService.updateInsuranceProvider(req.params.id, value);
    
    return ResponseUtil.success(res, {
      message: 'Insurance provider updated successfully',
      provider
    });
  }),

  // Insurance Plan endpoints
  createInsurancePlan: asyncHandler(async (req, res) => {
    const { error, value } = insuranceValidators.validateInsurancePlan.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const plan = await insuranceService.createInsurancePlan(value);
    
    return ResponseUtil.success(res, {
      message: 'Insurance plan created successfully',
      plan
    }, 201);
  }),

  getInsurancePlans: asyncHandler(async (req, res) => {
    const filters = {};
    
    if (req.query.providerId) {
      filters.providerId = req.query.providerId;
    }
    
    const plans = await insuranceService.getInsurancePlans(filters);
    
    return ResponseUtil.success(res, {
      count: plans.length,
      plans
    });
  }),

  getInsurancePlanById: asyncHandler(async (req, res) => {
    const plan = await insuranceService.getInsurancePlanById(req.params.id);
    
    return ResponseUtil.success(res, { plan });
  }),

  updateInsurancePlan: asyncHandler(async (req, res) => {
    const { error, value } = insuranceValidators.validateInsurancePlan.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const plan = await insuranceService.updateInsurancePlan(req.params.id, value);
    
    return ResponseUtil.success(res, {
      message: 'Insurance plan updated successfully',
      plan
    });
  }),

  // Patient Insurance endpoints
  addPatientInsurance: asyncHandler(async (req, res) => {
    const { error, value } = insuranceValidators.validatePatientInsurance.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const insurance = await insuranceService.addPatientInsurance(value);
    
    return ResponseUtil.success(res, {
      message: 'Patient insurance added successfully',
      insurance
    }, 201);
  }),

  getPatientInsurances: asyncHandler(async (req, res) => {
    const insurances = await insuranceService.getPatientInsurances(req.params.patientId);
    
    return ResponseUtil.success(res, {
      count: insurances.length,
      insurances
    });
  }),

  getPatientInsuranceById: asyncHandler(async (req, res) => {
    const insurance = await insuranceService.getPatientInsuranceById(req.params.id);
    
    return ResponseUtil.success(res, { insurance });
  }),

  updatePatientInsurance: asyncHandler(async (req, res) => {
    const { error, value } = insuranceValidators.validatePatientInsurance.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const insurance = await insuranceService.updatePatientInsurance(req.params.id, value);
    
    return ResponseUtil.success(res, {
      message: 'Patient insurance updated successfully',
      insurance
    });
  }),

  // Insurance verification endpoint
  verifyInsurance: asyncHandler(async (req, res) => {
    const { error, value } = insuranceValidators.validateInsuranceVerification.validate(req.body);
    if (error) {
      throw new ValidationError(error.message);
    }
    
    const verificationResult = await insuranceService.verifyInsurance(value.patientInsuranceId);
    
    return ResponseUtil.success(res, {
      message: verificationResult.isVerified ? 
        'Insurance verified successfully' : 
        'Insurance verification failed or incomplete',
      verified: verificationResult.isVerified,
      details: verificationResult.details
    });
  })
};

module.exports = insuranceController;
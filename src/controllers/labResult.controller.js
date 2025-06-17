const LabResult = require('../models/labResult.model');
const labIntegrationService = require('../services/labIntegration.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');

/**
 * Get available lab connections
 * @route GET /api/lab-results/connections
 * @access Private (Admin, Doctor)
 */
const getLabConnections = asyncHandler(async (req, res) => {
  const labConnections = labIntegrationService.getAvailableLabs();
  return ResponseUtil.success(res, { labConnections });
});

/**
 * Import lab results from a specified lab system
 * @route POST /api/lab-results/import/:patientId/:labName
 * @access Private (Admin, Doctor)
 */
const importLabResults = asyncHandler(async (req, res) => {
  const { patientId, labName } = req.params;
  const options = req.body.options || {};
  
  // Fetch pending lab results from the specified lab system
  const labData = await labIntegrationService.fetchPendingLabResults(
    patientId, 
    labName, 
    options
  );
  
  if (!labData || labData.length === 0) {
    return ResponseUtil.success(res, { 
      message: 'No new lab results found',
      labName,
      results: []
    });
  }
  
  // Process and import the lab results
  const importResult = await labIntegrationService.processAndImportLabResults(
    labData,
    patientId,
    req.user._id, // The doctor/user importing the results
    labName,
    labIntegrationService.labConnections[labName]?.format || 'api'
  );
  
  return ResponseUtil.success(res, {
    message: `Successfully processed ${importResult.saved.length} new lab results`,
    labName,
    results: importResult
  });
});

/**
 * Manually add a lab result
 * @route POST /api/lab-results/manual/:patientId
 * @access Private (Admin, Doctor, Nurse)
 */
const addManualLabResult = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  const labResultData = req.body;
  
  // Process and import the manual lab result
  const importResult = await labIntegrationService.processAndImportLabResults(
    labResultData,
    patientId,
    req.user._id, // The user adding the results
    'manual', // Source as manual
    'manual' // Format as manual
  );
  
  return ResponseUtil.success(res, {
    message: `Successfully added manual lab result`,
    results: importResult
  }, 201);
});

/**
 * Get lab results for a patient
 * @route GET /api/lab-results/patient/:patientId
 * @access Private
 */
const getPatientLabResults = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  
  const options = {
    page: req.query.page ? parseInt(req.query.page) : 1,
    limit: req.query.limit ? parseInt(req.query.limit) : 20,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    testCode: req.query.testCode,
    abnormalOnly: req.query.abnormalOnly === 'true',
    criticalOnly: req.query.criticalOnly === 'true',
    populate: req.query.populate === 'true'
  };
  
  const result = await labIntegrationService.getPatientLabResults(patientId, options);
  
  return ResponseUtil.success(res, result);
});

/**
 * Get a specific lab result by ID
 * @route GET /api/lab-results/:id
 * @access Private
 */
const getLabResultById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const includeRawData = req.query.includeRawData === 'true' && req.user.role === 'admin';
  
  const labResult = await LabResult.findById(id)
    .populate('orderedBy', 'firstName lastName')
    .populate('patient', 'firstName lastName dateOfBirth')
    .select(includeRawData ? '+rawData' : '-rawData');
    
  if (!labResult) {
    return ResponseUtil.error(res, 'Lab result not found', 404, 'NOT_FOUND');
  }
  
  return ResponseUtil.success(res, { labResult });
});

/**
 * Get history for a specific test
 * @route GET /api/lab-results/test-history/:patientId/:testCode
 * @access Private
 */
const getTestHistory = asyncHandler(async (req, res) => {
  const { patientId, testCode } = req.params;
  
  const options = {
    limit: req.query.limit ? parseInt(req.query.limit) : 10,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    sortDirection: req.query.sortDirection || 'desc'
  };
  
  const testHistory = await labIntegrationService.getTestHistory(
    patientId, 
    testCode, 
    options
  );
  
  return ResponseUtil.success(res, { 
    testHistory,
    testCode,
    testName: testHistory.length > 0 ? testHistory[0].testName : null
  });
});

/**
 * Update review status of a lab result
 * @route PATCH /api/lab-results/:id/review
 * @access Private (Doctor, Admin)
 */
const updateReviewStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reviewStatus } = req.body;
  
  if (!['pending', 'reviewed', 'action-required', 'no-action-needed'].includes(reviewStatus)) {
    return ResponseUtil.error(res, 'Invalid review status', 400, 'VALIDATION_ERROR');
  }
  
  const labResult = await LabResult.findById(id);
  
  if (!labResult) {
    return ResponseUtil.error(res, 'Lab result not found', 404, 'NOT_FOUND');
  }
  
  // Update the review status
  labResult.clinicalSignificance.reviewStatus = reviewStatus;
  labResult.clinicalSignificance.reviewedBy = req.user._id;
  labResult.clinicalSignificance.reviewDate = new Date();
  
  await labResult.save();
  
  logger.info(`Lab result ${id} review status updated to ${reviewStatus}`, {
    userId: req.user._id,
    labResultId: id
  });
  
  return ResponseUtil.success(res, { 
    message: 'Review status updated successfully',
    labResult
  });
});

/**
 * Get counts of lab results by status
 * @route GET /api/lab-results/counts/:patientId
 * @access Private
 */
const getLabResultCounts = asyncHandler(async (req, res) => {
  const { patientId } = req.params;
  
  const totalCount = await LabResult.countDocuments({ patient: patientId });
  const abnormalCount = await LabResult.countDocuments({ 
    patient: patientId,
    'clinicalSignificance.hasAbnormalValues': true
  });
  const criticalCount = await LabResult.countDocuments({
    patient: patientId,
    'clinicalSignificance.hasCriticalValues': true
  });
  const pendingReviewCount = await LabResult.countDocuments({
    patient: patientId,
    'clinicalSignificance.reviewStatus': 'pending'
  });
  
  return ResponseUtil.success(res, {
    counts: {
      total: totalCount,
      abnormal: abnormalCount,
      critical: criticalCount,
      pendingReview: pendingReviewCount
    }
  });
});

module.exports = {
  getLabConnections,
  importLabResults,
  addManualLabResult,
  getPatientLabResults,
  getLabResultById,
  getTestHistory,
  updateReviewStatus,
  getLabResultCounts
};
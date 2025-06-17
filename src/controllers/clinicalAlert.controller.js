const clinicalAlertService = require('../services/clinicalAlert.service');
const ApiError = require('../utils/api-error');
const catchAsync = require('../utils/catch-async');

/**
 * Get applicable alerts for a patient
 */
exports.getPatientAlerts = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const context = req.body;
  
  const alerts = await clinicalAlertService.getPatientAlerts(
    patientId, 
    req.user.id,
    context
  );
  
  res.status(200).json({
    success: true,
    data: alerts
  });
});

/**
 * Get user alert preferences
 */
exports.getUserPreferences = catchAsync(async (req, res) => {
  const preferences = await clinicalAlertService.getUserAlertPreferences(req.user.id);
  
  res.status(200).json({
    success: true,
    data: preferences
  });
});

/**
 * Update user alert preferences
 */
exports.updateUserPreferences = catchAsync(async (req, res) => {
  const updates = req.body;
  
  const preferences = await clinicalAlertService.updateUserPreferences(
    req.user.id,
    updates
  );
  
  res.status(200).json({
    success: true,
    message: 'Alert preferences updated successfully',
    data: preferences
  });
});

/**
 * Get all clinical alerts (for admin)
 */
exports.getAlerts = catchAsync(async (req, res) => {
  const result = await clinicalAlertService.getAlerts(req.query);
  
  res.status(200).json({
    success: true,
    data: result.alerts,
    pagination: result.pagination
  });
});

/**
 * Get a single alert by ID
 */
exports.getAlertById = catchAsync(async (req, res) => {
  const alert = await clinicalAlertService.getAlertById(req.params.id);
  
  if (!alert) {
    throw new ApiError(404, 'Alert not found');
  }
  
  res.status(200).json({
    success: true,
    data: alert
  });
});

/**
 * Create a new clinical alert
 */
exports.createAlert = catchAsync(async (req, res) => {
  const alert = await clinicalAlertService.createAlert(req.body);
  
  res.status(201).json({
    success: true,
    message: 'Alert created successfully',
    data: alert
  });
});

/**
 * Update a clinical alert
 */
exports.updateAlert = catchAsync(async (req, res) => {
  const alert = await clinicalAlertService.updateAlert(
    req.params.id,
    req.body
  );
  
  res.status(200).json({
    success: true,
    message: 'Alert updated successfully',
    data: alert
  });
});

/**
 * Delete a clinical alert
 */
exports.deleteAlert = catchAsync(async (req, res) => {
  await clinicalAlertService.deleteAlert(req.params.id);
  
  res.status(200).json({
    success: true,
    message: 'Alert deleted successfully'
  });
});

/**
 * Seed sample alerts (for development)
 */
exports.seedSampleAlerts = catchAsync(async (req, res) => {
  const count = await clinicalAlertService.seedSampleAlerts();
  
  res.status(200).json({
    success: true,
    message: `${count} sample alerts seeded successfully`
  });
});
// Example controller with error handling
// src/controllers/patient.controller.js

const { Patient } = require('../models');
const asyncHandler = require('../utils/async-handler.util');
const ApiResponse = require('../utils/response.util');
const { 
  ValidationError, 
  DatabaseError, 
  NotFoundError,
  AuthorizationError 
} = require('../utils/errors');

/**
 * Get all patients with pagination and filtering
 */
exports.getPatients = asyncHandler(async (req, res) => {
  // Implement pagination, filtering, etc.
  const patients = await Patient.find({});
  return ApiResponse.success(res, patients, 'Patients retrieved successfully');
});

/**
 * Get patient by ID
 */
exports.getPatientById = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  
  if (!patient) {
    throw NotFoundError.forResource('patient', req.params.id);
  }
  
  // Check if user has permission to view this patient
  if (!canViewPatient(req.user, patient)) {
    throw AuthorizationError.insufficientPermissions('patient', 'view');
  }
  
  return ApiResponse.success(res, patient, 'Patient retrieved successfully');
});

/**
 * Create a new patient
 */
exports.createPatient = asyncHandler(async (req, res) => {
  try {
    const newPatient = await Patient.create(req.body);
    return ApiResponse.created(res, newPatient, 'Patient created successfully');
  } catch (error) {
    // Let the global error handler handle this
    throw error;
  }
});

/**
 * Update patient
 */
exports.updatePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  
  if (!patient) {
    throw NotFoundError.forResource('patient', req.params.id);
  }
  
  // Check if user has permission to update this patient
  if (!canUpdatePatient(req.user, patient)) {
    throw AuthorizationError.insufficientPermissions('patient', 'update');
  }
  
  // Update patient
  const updatedPatient = await Patient.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  return ApiResponse.success(res, updatedPatient, 'Patient updated successfully');
});

/**
 * Delete patient
 */
exports.deletePatient = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  
  if (!patient) {
    throw NotFoundError.forResource('patient', req.params.id);
  }
  
  // Check if user has permission to delete this patient
  if (!canDeletePatient(req.user, patient)) {
    throw AuthorizationError.hipaaViolation();
  }
  
  await patient.remove();
  
  return ApiResponse.noContent(res);
});

// Helper functions to check permissions
function canViewPatient(user, patient) {
  // Implement permission logic
  return true; // Placeholder
}

function canUpdatePatient(user, patient) {
  // Implement permission logic
  return true; // Placeholder
}

function canDeletePatient(user, patient) {
  // Implement permission logic
  return true; // Placeholder
}
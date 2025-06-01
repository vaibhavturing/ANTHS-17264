// src/controllers/patient.controller.js

/**
 * Patient controller with standardized responses
 * Demonstrates usage of response utilities, pagination, and data transformation
 */

const { Patient } = require('../models');
const asyncHandler = require('../utils/async-handler.util');
const { applyPagination, buildPaginationResult } = require('../utils/pagination.util');
const { transformResponse, applyHIPAAProtection } = require('../utils/transform.util');
const { NotFoundError, AuthorizationError } = require('../utils/errors');

/**
 * Get all patients with pagination and filtering
 */
exports.getPatients = asyncHandler(async (req, res) => {
  // Define fields allowed to be filtered
  const filterConfig = {
    allowedFields: ['status', 'gender', 'doctor', 'insuranceProvider', 'ageGroup'],
    gender: { type: 'string', exactMatch: true },
    doctor: { type: 'objectId' },
    status: { type: 'string' },
    age_gte: { type: 'number' },
    age_lte: { type: 'number' }
  };
  
  // Build and apply query with pagination
  let query = Patient.find();
  
  // Apply pagination, sorting, and filtering
  const paginatedQuery = applyPagination(query, req, {
    allowedSortFields: ['lastName', 'firstName', 'dateOfBirth', 'createdAt', 'updatedAt'],
    defaultSort: { lastName: 1, firstName: 1 }
  });
  
  // Execute query with pagination
  const result = await buildPaginationResult(
    paginatedQuery,
    Patient.countDocuments(paginatedQuery.filter),
    paginatedQuery.query
  );
  
  // Apply HIPAA protection and transformation
  const transformedData = result.data.map(patient => 
    applyHIPAAProtection(patient, req.user, {
      audit: true,
      auditService: req.app.get('auditService'),
      action: 'list'
    })
  );
  
  // Return paginated response with transformed data
  return res.paginated(
    transformedData,
    result.pagination,
    'Patients retrieved successfully'
  );
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
  
  // Apply HIPAA protection and transformation
  const transformedPatient = applyHIPAAProtection(patient, req.user, {
    audit: true,
    auditService: req.app.get('auditService'),
    action: 'view'
  });
  
  // Return success response
  return res.success(
    transformedPatient,
    'Patient retrieved successfully'
  );
});

/**
 * Create a new patient
 */
exports.createPatient = asyncHandler(async (req, res) => {
  // Create new patient
  const newPatient = await Patient.create(req.body);
  
  // Transform data for response
  const transformedPatient = transformResponse(newPatient);
  
  // Return created response with location header
  return res.created(
    transformedPatient, 
    'Patient created successfully',
    { resourcePath: 'patients' }
  );
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
  
  // Transform data for response
  const transformedPatient = transformResponse(updatedPatient);
  
  return res.success(
    transformedPatient, 
    'Patient updated successfully'
  );
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
  
  return res.noContent();
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
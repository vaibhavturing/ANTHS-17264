/**
 * Patient Controller
 * Handles all patient-related operations with HIPAA compliance
 */

const logger = require('../utils/logger');
const asyncHandler = require('../utils/async-handler.util');
const { success } = require('../utils/response.util');
const Patient = require('../models/patient.model');
const { NotFoundError } = require('../utils/errors/NotFoundError');
const auditLogger = require('../utils/audit-logger');
const patientService = require('../services/patient.service');

/**
 * Patient profile controller
 */
const patientController = {
  /**
   * Create a new patient profile
   * @route POST /api/patients
   */
  createPatient: asyncHandler(async (req, res) => {
    const { userId } = req.user;
    const patientData = req.body;
    
    const patient = await patientService.createPatient(patientData, userId);
    
    return ResponseUtil.success(res, { 
      message: 'Patient profile created successfully',
      patient 
    }, 201);
  }),

  /**
   * Get patient by ID
   * @route GET /api/patients/:patientId
   */
  getPatientById: asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    const patient = await patientService.getPatientById(patientId);
    
    return ResponseUtil.success(res, { patient });
  }),

  /**
   * Get patient by user ID
   * @route GET /api/patients/user/:userId
   */
  getPatientByUserId: asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const patient = await patientService.getPatientByUserId(userId);
    
    return ResponseUtil.success(res, { patient });
  }),

  /**
   * Get current user's patient profile
   * @route GET /api/patients/me
   */
  getMyProfile: asyncHandler(async (req, res) => {
    const { userId } = req.user;
    const patient = await patientService.getPatientByUserId(userId);
    
    return ResponseUtil.success(res, { patient });
  }),

  /**
   * Update patient profile
   * @route PUT /api/patients/:patientId
   */
  updatePatient: asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    const updateData = req.body;
    
    const patient = await patientService.updatePatient(patientId, updateData);
    
    return ResponseUtil.success(res, { 
      message: 'Patient profile updated successfully',
      patient 
    });
  }),

  /**
   * Get patient's complete medical profile with all records
   * @route GET /api/patients/:patientId/profile
   */
  getPatientProfile: asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    const profile = await patientService.getPatientProfile(patientId);
    
    return ResponseUtil.success(res, { profile });
  })
};


/**
 * Get all patients with pagination and filtering
 */
const getPatients = asyncHandler(async (req, res) => {
  // Extract query parameters
  const { 
    page = 1, 
    limit = 10, 
    search, 
    insuranceProvider, 
    doctorId,
    sortBy = 'lastName',
    sortOrder = 'asc'
  } = req.query;
  
  const skip = (page - 1) * limit;
  
  // Build query filters
  const query = {};
  
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { 'contactInformation.email': { $regex: search, $options: 'i' } },
      { 'contactInformation.phone': { $regex: search, $options: 'i' } },
      { 'medicalInformation.patientId': { $regex: search, $options: 'i' } }
    ];
  }
  
  if (insuranceProvider) {
    query['insurance.provider'] = insuranceProvider;
  }
  
  if (doctorId) {
    query.assignedDoctors = doctorId;
  }
  
  // Sort direction
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  
  // Execute query with pagination
  const [patients, total] = await Promise.all([
    Patient.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ [sortBy]: sortDirection })
      .lean(),
    Patient.countDocuments(query)
  ]);
  
  // Log the access to patient data
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'list',
    resourceType: 'patient',
    resourceId: 'multiple',
    metadata: {
      filters: { search, insuranceProvider, doctorId },
      resultCount: patients.length
    }
  });
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  
  return success(res, {
    patients,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    }
  });
});

/**
 * Get a patient by ID
 */
const getPatientById = asyncHandler(async (req, res) => {
  const patient = await Patient.findById(req.params.id).lean();
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Log the access to patient data
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view',
    resourceType: 'patient',
    resourceId: req.params.id,
    metadata: {
      isPatientSelf: req.user.patientId === req.params.id
    }
  });
  
  return success(res, { patient });
});

/**
 * Create a new patient
 */
const createPatient = asyncHandler(async (req, res) => {
  const {
    userId,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    contactInformation,
    emergencyContact,
    medicalInformation,
    insurance
  } = req.body;
  
  // Create new patient
  const patient = new Patient({
    userId,
    firstName,
    lastName,
    dateOfBirth,
    gender,
    contactInformation,
    emergencyContact,
    medicalInformation,
    insurance
  });
  
  await patient.save();
  
  // Log the creation of patient data
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'create',
    resourceType: 'patient',
    resourceId: patient._id.toString(),
    changes: {
      changedFields: Object.keys(req.body)
    }
  });
  
  logger.info('New patient created', { patientId: patient._id });
  
  return success(res, { patient }, 201);
});

/**
 * Update a patient
 */
const updatePatient = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const updateData = req.body;
  
  // Find patient
  const patient = await Patient.findById(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Save previous data for audit
  const previousData = patient.toObject();
  
  // Update all fields
  Object.keys(updateData).forEach(key => {
    patient[key] = updateData[key];
  });
  
  // Record modification timestamp
  patient.updatedAt = new Date();
  patient.updatedBy = req.user.id;
  
  await patient.save();
  
  // Log the update of patient data
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update',
    resourceType: 'patient',
    resourceId: patientId,
    changes: {
      changedFields: Object.keys(updateData),
      previousData
    }
  });
  
  logger.info('Patient updated', { patientId });
  
  return success(res, { patient });
});

/**
 * Partially update a patient
 */
const partialUpdatePatient = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const updateData = req.body;
  
  // Find patient
  const patient = await Patient.findById(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Save previous data for audit
  const previousData = patient.toObject();
  
  // Update only the fields that are provided
  Object.keys(updateData).forEach(key => {
    patient[key] = updateData[key];
  });
  
  // Record modification timestamp
  patient.updatedAt = new Date();
  patient.updatedBy = req.user.id;
  
  await patient.save();
  
  // Log the partial update of patient data
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'partial_update',
    resourceType: 'patient',
    resourceId: patientId,
    changes: {
      changedFields: Object.keys(updateData),
      previousData
    }
  });
  
  logger.info('Patient partially updated', { patientId, fields: Object.keys(updateData) });
  
  return success(res, { patient });
});

/**
 * Delete a patient (soft delete)
 */
const deletePatient = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  
  // Find patient
  const patient = await Patient.findById(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Soft delete by setting to inactive
  patient.active = false;
  patient.deactivatedAt = new Date();
  patient.deactivatedBy = req.user.id;
  await patient.save();
  
  // Log the deletion of patient data
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'delete',
    resourceType: 'patient',
    resourceId: patientId
  });
  
  logger.info('Patient deactivated (soft deleted)', { patientId });
  
  return success(res, { message: 'Patient successfully deleted' });
});

/**
 * Get patient allergies
 */
const getPatientAllergies = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  
  // Find patient
  const patient = await Patient.findById(patientId)
    .select('medicalInformation.allergies')
    .lean();
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Log the access to patient allergies
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view',
    resourceType: 'patient_allergies',
    resourceId: patientId
  });
  
  return success(res, { 
    allergies: patient.medicalInformation?.allergies || [] 
  });
});

/**
 * Update patient allergies
 */
const updatePatientAllergies = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const { allergies } = req.body;
  
  // Find patient
  const patient = await Patient.findById(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Save previous allergies for audit
  const previousAllergies = patient.medicalInformation?.allergies || [];
  
  // Update allergies
  if (!patient.medicalInformation) {
    patient.medicalInformation = {};
  }
  patient.medicalInformation.allergies = allergies;
  patient.updatedAt = new Date();
  patient.updatedBy = req.user.id;
  
  await patient.save();
  
  // Log the update of patient allergies
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update',
    resourceType: 'patient_allergies',
    resourceId: patientId,
    changes: {
      previousAllergies,
      newAllergies: allergies
    }
  });
  
  logger.info('Patient allergies updated', { patientId });
  
  return success(res, { 
    allergies: patient.medicalInformation.allergies 
  });
});

/**
 * Get patient medications
 */
const getPatientMedications = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  
  // Find patient
  const patient = await Patient.findById(patientId)
    .select('medicalInformation.medications')
    .lean();
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Log the access to patient medications
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view',
    resourceType: 'patient_medications',
    resourceId: patientId
  });
  
  return success(res, { 
    medications: patient.medicalInformation?.medications || [] 
  });
});

/**
 * Update patient medications
 */
const updatePatientMedications = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const { medications } = req.body;
  
  // Find patient
  const patient = await Patient.findById(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Save previous medications for audit
  const previousMedications = patient.medicalInformation?.medications || [];
  
  // Update medications
  if (!patient.medicalInformation) {
    patient.medicalInformation = {};
  }
  patient.medicalInformation.medications = medications;
  patient.updatedAt = new Date();
  patient.updatedBy = req.user.id;
  
  await patient.save();
  
  // Log the update of patient medications (this is a prescription, so log as such)
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'prescribe',
    resourceType: 'patient_medications',
    resourceId: patientId,
    changes: {
      previousMedications,
      newMedications: medications
    }
  });
  
  logger.info('Patient medications updated', { patientId });
  
  return success(res, { 
    medications: patient.medicalInformation.medications 
  });
});

/**
 * Get patient insurance information
 */
const getPatientInsurance = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  
  // Find patient
  const patient = await Patient.findById(patientId)
    .select('insurance')
    .lean();
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Log the access to patient insurance info
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view',
    resourceType: 'patient_insurance',
    resourceId: patientId
  });
  
  return success(res, { 
    insurance: patient.insurance || {} 
  });
});

/**
 * Update patient insurance information
 */
const updatePatientInsurance = asyncHandler(async (req, res) => {
  const patientId = req.params.id;
  const { insurance } = req.body;
  
  // Find patient
  const patient = await Patient.findById(patientId);
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Save previous insurance for audit
  const previousInsurance = patient.insurance || {};
  
  // Update insurance
  patient.insurance = insurance;
  patient.updatedAt = new Date();
  patient.updatedBy = req.user.id;
  
  await patient.save();
  
  // Log the update of patient insurance
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update',
    resourceType: 'patient_insurance',
    resourceId: patientId,
    changes: {
      previousInsurance,
      newInsurance: insurance
    }
  });
  
  logger.info('Patient insurance updated', { patientId });
  
  return success(res, { 
    insurance: patient.insurance 
  });
});

module.exports = {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  partialUpdatePatient,
  deletePatient,
  getPatientAllergies,
  updatePatientAllergies,
  getPatientMedications,
  updatePatientMedications,
  getPatientInsurance,
  updatePatientInsurance
};
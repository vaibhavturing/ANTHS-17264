/**
 * Medical Record Controller
 * Handles medical record operations with strict HIPAA compliance
 */

const logger = require('../utils/logger');
const asyncHandler = require('../utils/async-handler.util');
const { success } = require('../utils/response.util');
const MedicalRecord = require('../models/medicalRecord.model');
const Patient = require('../models/patient.model');
const { NotFoundError } = require('../utils/errors/NotFoundError');
const { AuthorizationError } = require('../utils/errors/AuthorizationError');
const auditLogger = require('../utils/audit-logger');

/**
 * Get medical records for a patient
 */
const getPatientMedicalRecords = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'visitDate',
    sortOrder = 'desc',
    type
  } = req.query;
  
  const patientId = req.params.patientId;
  const skip = (page - 1) * limit;
  
  // Verify patient exists
  const patient = await Patient.findById(patientId).select('_id').lean();
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Build query
  const query = { patientId };
  
  if (type) {
    query.recordType = type;
  }
  
  // Sort direction
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  
  // Execute query
  const [records, total] = await Promise.all([
    MedicalRecord.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ [sortBy]: sortDirection })
      .lean(),
    MedicalRecord.countDocuments(query)
  ]);
  
  // Log the access to medical records (HIPAA)
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'list',
    resourceType: 'medical_record',
    resourceId: 'multiple',
    metadata: {
      patientId,
      filters: { type },
      resultCount: records.length,
      purpose: 'patient_care'
    }
  });
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);
  
  return success(res, {
    records,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    }
  });
});

/**
 * Get a medical record by ID
 */
const getMedicalRecordById = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId).lean();
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Log the access to the medical record (HIPAA)
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view',
    resourceType: 'medical_record',
    resourceId: recordId,
    metadata: {
      patientId: record.patientId,
      recordType: record.recordType,
      purpose: req.query.purpose || 'patient_care'
    }
  });
  
  return success(res, { record });
});

/**
 * Create a new medical record
 */
const createMedicalRecord = asyncHandler(async (req, res) => {
  const {
    patientId,
    visitDate,
    recordType,
    chiefComplaint,
    vitalSigns,
    diagnosis,
    treatmentPlan,
    medications,
    notes,
    attachments,
    followUp
  } = req.body;
  
  // Verify patient exists
  const patient = await Patient.findById(patientId).select('_id').lean();
  
  if (!patient) {
    throw new NotFoundError('Patient not found');
  }
  
  // Create new medical record
  const record = new MedicalRecord({
    patientId,
    visitDate: visitDate || new Date(),
    recordType,
    providerId: req.user.id,
    chiefComplaint,
    vitalSigns,
    diagnosis,
    treatmentPlan,
    medications,
    notes,
    attachments,
    followUp,
    accessLog: [{
      userId: req.user.id,
      action: 'create',
      timestamp: new Date(),
      reason: 'Initial creation'
    }]
  });
  
  await record.save();
  
  // Log the creation of medical record (HIPAA)
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'create',
    resourceType: 'medical_record',
    resourceId: record._id.toString(),
    changes: {
      changedFields: Object.keys(req.body)
    },
    metadata: {
      patientId,
      recordType
    }
  });
  
  logger.info('New medical record created', { 
    recordId: record._id, 
    patientId,
    recordType
  });
  
  return success(res, { record }, 201);
});

/**
 * Update a medical record
 */
const updateMedicalRecord = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  const updateData = req.body;
  const { reason } = req.query;
  
  if (!reason) {
    throw new BusinessLogicError('Reason for medical record update is required (HIPAA)');
  }
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId);
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Check if the user is the record creator or has admin rights
  if (record.providerId.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AuthorizationError('Only the provider who created this record can update it');
  }
  
  // Save previous record for audit
  const previousData = record.toObject();
  
  // Prevent modification of critical fields
  delete updateData.patientId;
  delete updateData.providerId;
  delete updateData.createdAt;
  delete updateData.accessLog;
  
  // Update fields
  Object.keys(updateData).forEach(key => {
    record[key] = updateData[key];
  });
  
  // Add to amendment history
  record.amendmentHistory = record.amendmentHistory || [];
  record.amendmentHistory.push({
    providerId: req.user.id,
    timestamp: new Date(),
    reason,
    changes: Object.keys(updateData),
    previousData
  });
  
  // Add to access log
  record.accessLog.push({
    userId: req.user.id,
    action: 'update',
    timestamp: new Date(),
    reason
  });
  
  record.updatedAt = new Date();
  record.updatedBy = req.user.id;
  
  await record.save();
  
  // Log the update of medical record (HIPAA)
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'update',
    resourceType: 'medical_record',
    resourceId: recordId,
    changes: {
      changedFields: Object.keys(updateData),
      reason
    },
    metadata: {
      patientId: record.patientId,
      recordType: record.recordType
    }
  });
  
  logger.info('Medical record updated', { 
    recordId, 
    patientId: record.patientId,
    fields: Object.keys(updateData),
    reason
  });
  
  return success(res, { record });
});

/**
 * Partially update a medical record
 */
const partialUpdateMedicalRecord = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  const updateData = req.body;
  const { reason } = req.query;
  
  if (!reason) {
    throw new BusinessLogicError('Reason for medical record update is required (HIPAA)');
  }
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId);
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Check if the user is the record creator or has admin rights
  if (record.providerId.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AuthorizationError('Only the provider who created this record can update it');
  }
  
  // Save previous record for audit
  const previousData = record.toObject();
  
  // Prevent modification of critical fields
  delete updateData.patientId;
  delete updateData.providerId;
  delete updateData.createdAt;
  delete updateData.accessLog;
  
  // Update only provided fields
  Object.keys(updateData).forEach(key => {
    record[key] = updateData[key];
  });
  
  // Add to amendment history
  record.amendmentHistory = record.amendmentHistory || [];
  record.amendmentHistory.push({
    providerId: req.user.id,
    timestamp: new Date(),
    reason,
    changes: Object.keys(updateData)
  });
  
  // Add to access log
  record.accessLog.push({
    userId: req.user.id,
    action: 'partial_update',
    timestamp: new Date(),
    reason
  });
  
  record.updatedAt = new Date();
  record.updatedBy = req.user.id;
  
  await record.save();
  
  // Log the partial update of medical record (HIPAA)
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'partial_update',
    resourceType: 'medical_record',
    resourceId: recordId,
    changes: {
      changedFields: Object.keys(updateData),
      reason
    },
    metadata: {
      patientId: record.patientId,
      recordType: record.recordType
    }
  });
  
  logger.info('Medical record partially updated', { 
    recordId, 
    patientId: record.patientId,
    fields: Object.keys(updateData),
    reason
  });
  
  return success(res, { record });
});

/**
 * Add attachment to medical record
 */
const addAttachment = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  const { fileName, fileType, fileData, description } = req.body;
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId);
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Create new attachment with unique ID
  const attachmentId = new mongoose.Types.ObjectId();
  
  const attachment = {
    _id: attachmentId,
    fileName,
    fileType,
    fileData, // In real app, this would likely be a path or reference to storage
    description,
    uploadedBy: req.user.id,
    uploadedAt: new Date()
  };
  
  // Add the attachment
  if (!record.attachments) {
    record.attachments = [];
  }
  
  record.attachments.push(attachment);
  
  // Add to access log
  record.accessLog.push({
    userId: req.user.id,
    action: 'add_attachment',
    timestamp: new Date(),
    details: `Added attachment: ${fileName}`
  });
  
  record.updatedAt = new Date();
  record.updatedBy = req.user.id;
  
  await record.save();
  
  // Log the addition of attachment (HIPAA)
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'add_attachment',
    resourceType: 'medical_record',
    resourceId: recordId,
    changes: {
      attachmentId: attachmentId.toString(),
      fileName,
      fileType
    },
    metadata: {
      patientId: record.patientId
    }
  });
  
  logger.info('Attachment added to medical record', { 
    recordId,
    attachmentId: attachmentId.toString(),
    fileName
  });
  
  return success(res, { 
    attachment: {
      ...attachment,
      fileData: 'REDACTED' // Don't return the actual file data in response
    }
  });
});

/**
 * Get an attachment from a medical record
 */
const getAttachment = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  const attachmentId = req.params.attachmentId;
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId);
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Find the attachment
  const attachment = record.attachments && record.attachments.find(
    a => a._id.toString() === attachmentId
  );
  
  if (!attachment) {
    throw new NotFoundError('Attachment not found');
  }
  
  // Add to access log
  record.accessLog.push({
    userId: req.user.id,
    action: 'view_attachment',
    timestamp: new Date(),
    details: `Viewed attachment: ${attachment.fileName}`
  });
  
  await record.save();
  
  // Log the access to attachment (HIPAA)
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view_attachment',
    resourceType: 'medical_record_attachment',
    resourceId: attachmentId,
    metadata: {
      recordId,
      patientId: record.patientId,
      fileName: attachment.fileName
    }
  });
  
  // In a real app, this would handle attachment download
  return success(res, { attachment });
});

/**
 * Remove an attachment from a medical record
 */
const removeAttachment = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  const attachmentId = req.params.attachmentId;
  const { reason } = req.query;
  
  if (!reason) {
    throw new BusinessLogicError('Reason for attachment removal is required (HIPAA)');
  }
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId);
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Check if the user is the record creator or has admin rights
  if (record.providerId.toString() !== req.user.id && req.user.role !== 'admin') {
    throw new AuthorizationError('Only the provider who created this record can remove attachments');
  }
  
  // Find the attachment
  const attachmentIndex = record.attachments && record.attachments.findIndex(
    a => a._id.toString() === attachmentId
  );
  
  if (attachmentIndex === -1 || attachmentIndex === undefined) {
    throw new NotFoundError('Attachment not found');
  }
  
  // Store attachment information for logging
  const removedAttachment = record.attachments[attachmentIndex];
  
  // Remove the attachment
  record.attachments.splice(attachmentIndex, 1);
  
  // Add to access log
  record.accessLog.push({
    userId: req.user.id,
    action: 'remove_attachment',
    timestamp: new Date(),
    details: `Removed attachment: ${removedAttachment.fileName}. Reason: ${reason}`
  });
  
  record.updatedAt = new Date();
  record.updatedBy = req.user.id;
  
  await record.save();
  
  // Log the removal of attachment (HIPAA)
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'remove_attachment',
    resourceType: 'medical_record',
    resourceId: recordId,
    changes: {
      attachmentId,
      fileName: removedAttachment.fileName,
      reason
    },
    metadata: {
      patientId: record.patientId
    }
  });
  
  logger.info('Attachment removed from medical record', { 
    recordId,
    attachmentId,
    fileName: removedAttachment.fileName,
    reason
  });
  
  return success(res, { 
    message: 'Attachment successfully removed',
    fileName: removedAttachment.fileName
  });
});

/**
 * Share a medical record with another provider
 */
const shareRecord = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  const { providerId, reason, expiration } = req.body;
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId);
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Create new share entry
  const shareId = new mongoose.Types.ObjectId();
  
  const shareEntry = {
    _id: shareId,
    providerId,
    sharedBy: req.user.id,
    sharedAt: new Date(),
    reason,
    expiration: expiration ? new Date(expiration) : null
  };
  
  // Add the share entry
  if (!record.sharedWith) {
    record.sharedWith = [];
  }
  
  record.sharedWith.push(shareEntry);
  
  // Add to access log
  record.accessLog.push({
    userId: req.user.id,
    action: 'share',
    timestamp: new Date(),
    details: `Shared with provider: ${providerId}. Reason: ${reason}`
  });
  
  record.updatedAt = new Date();
  record.updatedBy = req.user.id;
  
  await record.save();
  
  // Log the record sharing (HIPAA)
  auditLogger.logPhiDisclosure({
    userId: req.user.id,
    patientId: record.patientId,
    recipientType: 'provider',
    recipientId: providerId,
    purpose: reason,
    informationType: 'medical_record',
    metadata: {
      recordId,
      expiration: expiration || 'none'
    }
  });
  
  logger.info('Medical record shared with provider', { 
    recordId,
    patientId: record.patientId,
    providerId,
    reason
  });
  
  return success(res, { 
    message: 'Medical record successfully shared',
    shareDetails: shareEntry
  });
});

/**
 * Get access log for a medical record
 */
const getRecordAccessLog = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId)
    .select('accessLog patientId')
    .lean();
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Log this access to the access log (recursive, but important for audit)
  auditLogger.logDataAccess({
    userId: req.user.id,
    action: 'view_access_log',
    resourceType: 'medical_record_log',
    resourceId: recordId,
    metadata: {
      patientId: record.patientId
    }
  });
  
  return success(res, { accessLog: record.accessLog || [] });
});

/**
 * Record patient consent for sharing medical record
 */
const recordConsent = asyncHandler(async (req, res) => {
  const recordId = req.params.id;
  const { consentGiven, providers, purpose, expiration, restrictions } = req.body;
  
  // Find medical record
  const record = await MedicalRecord.findById(recordId);
  
  if (!record) {
    throw new NotFoundError('Medical record not found');
  }
  
  // Verify patient is giving consent for their own record
  if (req.user.patientId !== record.patientId.toString()) {
    throw new AuthorizationError('Only the patient can provide consent for their own records');
  }
  
  // Create new consent record
  const consentRecord = {
    consentGiven,
    consentDate: new Date(),
    patientId: req.user.patientId,
    providers, // Array of provider IDs
    purpose,
    expiration: expiration ? new Date(expiration) : null,
    restrictions
  };
  
  // Update consent information
  record.consent = consentRecord;
  
  // Add to access log
  record.accessLog.push({
    userId: req.user.id,
    action: 'record_consent',
    timestamp: new Date(),
    details: `Patient ${consentGiven ? 'provided' : 'revoked'} consent for sharing medical record. Purpose: ${purpose}`
  });
  
  record.updatedAt = new Date();
  record.updatedBy = req.user.id;
  
  await record.save();
  
  // Log the consent (HIPAA)
  auditLogger.logDataModification({
    userId: req.user.id,
    action: 'record_consent',
    resourceType: 'medical_record',
    resourceId: recordId,
    changes: {
      consentGiven,
      purpose,
      providers
    },
    metadata: {
      patientId: record.patientId
    }
  });
  
  logger.info(`Patient ${consentGiven ? 'provided' : 'revoked'} consent for medical record sharing`, { 
    recordId,
    patientId: record.patientId,
    purpose
  });
  
  return success(res, { 
    message: `Consent ${consentGiven ? 'provided' : 'revoked'} successfully`,
    consent: consentRecord
  });
});

module.exports = {
  getPatientMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  partialUpdateMedicalRecord,
  addAttachment,
  getAttachment,
  removeAttachment,
  shareRecord,
  getRecordAccessLog,
  recordConsent
};
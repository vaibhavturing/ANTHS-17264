// src/services/medicalRecord.service.js

const { MedicalRecord, RECORD_CATEGORIES, auditActions } = require('../models/medicalRecord.model');
const { Patient } = require('../models/patient.model');
const { User } = require('../models/user.model');
const { ValidationError, NotFoundError, AuthorizationError } = require('../utils/errors');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Medical Records Service
 * Handles operations related to patient medical records
 */
const medicalRecordService = {
  /**
   * Create a new medical record
   * @param {Object} recordData - Medical record data
   * @param {Object} user - Current user
   * @param {Object} fileData - Optional file attachment data
   * @returns {Promise<Object>} Created medical record
   */
  createMedicalRecord: async (recordData, user, fileData = null) => {
    try {
      // Check if patient exists
      const patient = await Patient.findById(recordData.patient);
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Create the medical record
      const medicalRecord = new MedicalRecord({
        ...recordData,
        provider: recordData.provider || user._id,
      });

      // Set default access controls (provider gets admin access)
      medicalRecord.accessControls = [
        {
          user: user._id,
          accessLevel: 'admin',
          grantedBy: user._id,
          grantedAt: Date.now()
        }
      ];

      // Add attachment if provided
      if (fileData) {
        medicalRecord.attachments.push({
          ...fileData,
          uploadedBy: user._id
        });
      }

      // Add audit log entry
      medicalRecord.addAuditLogEntry({
        user: user._id,
        action: 'create',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        details: `Created ${recordData.category} record: ${recordData.title}`
      });

      // Save the record
      await medicalRecord.save();

      logger.info(`Medical record created for patient ${patient._id}`, {
        userId: user._id,
        patientId: patient._id,
        recordId: medicalRecord._id
      });

      return medicalRecord;
    } catch (error) {
      logger.error('Error creating medical record', {
        error: error.message,
        userId: user?._id,
        patientId: recordData?.patient
      });
      throw error;
    }
  },

  /**
   * Get a medical record by ID with access control
   * @param {string} recordId - Medical record ID
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Medical record
   */
  getMedicalRecordById: async (recordId, user) => {
    try {
      // Get the record with patient info and provider info
      const medicalRecord = await MedicalRecord.findById(recordId)
        .populate('patient', 'firstName lastName gender dateOfBirth')
        .populate('provider', 'firstName lastName role')
        .populate('accessControls.user', 'firstName lastName role email');

      if (!medicalRecord || medicalRecord.isDeleted) {
        throw new NotFoundError('Medical record not found');
      }

      // Check if user has access permissions
      // Admins have access to all records
      // Doctors/providers have access to records they created
      // Other users need specific access granted
      const isAdmin = user.roles.some(role => role.name === 'admin');
      const isProvider = medicalRecord.provider && 
                        medicalRecord.provider._id.toString() === user._id.toString();
      const isPatient = medicalRecord.patient && 
                        medicalRecord.patient._id.toString() === user._id.toString();
      const hasGrantedAccess = medicalRecord.hasAccess(user._id, 'read');

      if (!isAdmin && !isProvider && !isPatient && !hasGrantedAccess) {
        throw new AuthorizationError('You do not have permission to view this medical record');
      }

      // Add audit log entry for viewing the record
      medicalRecord.addAuditLogEntry({
        user: user._id,
        action: 'view',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent
      });

      await medicalRecord.save();

      logger.info(`Medical record ${recordId} accessed`, {
        userId: user._id,
        recordId
      });

      return medicalRecord;
    } catch (error) {
      logger.error(`Error retrieving medical record ${recordId}`, {
        error: error.message,
        userId: user?._id
      });
      throw error;
    }
  },

  /**
   * Update a medical record
   * @param {string} recordId - Medical record ID
   * @param {Object} updateData - Data to update
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Updated medical record
   */
  updateMedicalRecord: async (recordId, updateData, user) => {
    try {
      const medicalRecord = await MedicalRecord.findById(recordId);

      if (!medicalRecord || medicalRecord.isDeleted) {
        throw new NotFoundError('Medical record not found');
      }

      // Check if user has write access
      const isAdmin = user.roles.some(role => role.name === 'admin');
      const isProvider = medicalRecord.provider.toString() === user._id.toString();
      const hasWriteAccess = medicalRecord.hasAccess(user._id, 'write');

      if (!isAdmin && !isProvider && !hasWriteAccess) {
        throw new AuthorizationError('You do not have permission to update this medical record');
      }

      // Update the record with the provided data
      Object.keys(updateData).forEach(key => {
        medicalRecord[key] = updateData[key];
      });

      // Add audit log entry
      medicalRecord.addAuditLogEntry({
        user: user._id,
        action: 'update',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        details: `Updated medical record: ${Object.keys(updateData).join(', ')}`
      });

      await medicalRecord.save();

      logger.info(`Medical record ${recordId} updated`, {
        userId: user._id,
        recordId,
        updatedFields: Object.keys(updateData)
      });

      return medicalRecord;
    } catch (error) {
      logger.error(`Error updating medical record ${recordId}`, {
        error: error.message,
        userId: user?._id
      });
      throw error;
    }
  },

  /**
   * Delete a medical record (soft delete)
   * @param {string} recordId - Medical record ID
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Result message
   */
  deleteMedicalRecord: async (recordId, user) => {
    try {
      const medicalRecord = await MedicalRecord.findById(recordId);

      if (!medicalRecord || medicalRecord.isDeleted) {
        throw new NotFoundError('Medical record not found');
      }

      // Check if user has admin access to the record
      const isAdmin = user.roles.some(role => role.name === 'admin');
      const isProvider = medicalRecord.provider.toString() === user._id.toString();
      const hasAdminAccess = medicalRecord.hasAccess(user._id, 'admin');

      if (!isAdmin && !isProvider && !hasAdminAccess) {
        throw new AuthorizationError('You do not have permission to delete this medical record');
      }

      // Soft delete
      medicalRecord.isDeleted = true;
      medicalRecord.deletedAt = Date.now();
      medicalRecord.deletedBy = user._id;

      // Add audit log entry
      medicalRecord.addAuditLogEntry({
        user: user._id,
        action: 'delete',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        details: 'Medical record deleted'
      });

      await medicalRecord.save();

      logger.info(`Medical record ${recordId} deleted`, {
        userId: user._id,
        recordId
      });

      return { message: 'Medical record successfully deleted' };
    } catch (error) {
      logger.error(`Error deleting medical record ${recordId}`, {
        error: error.message,
        userId: user?._id
      });
      throw error;
    }
  },

  /**
   * Add a file attachment to a medical record
   * @param {string} recordId - Medical record ID
   * @param {Object} fileData - File data
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Updated medical record
   */
  addAttachment: async (recordId, fileData, user) => {
    try {
      const medicalRecord = await MedicalRecord.findById(recordId);

      if (!medicalRecord || medicalRecord.isDeleted) {
        throw new NotFoundError('Medical record not found');
      }

      // Check if user has write access
      const isAdmin = user.roles.some(role => role.name === 'admin');
      const isProvider = medicalRecord.provider.toString() === user._id.toString();
      const hasWriteAccess = medicalRecord.hasAccess(user._id, 'write');

      if (!isAdmin && !isProvider && !hasWriteAccess) {
        throw new AuthorizationError('You do not have permission to add attachments to this record');
      }

      // Add the new attachment
      medicalRecord.attachments.push({
        ...fileData,
        uploadedBy: user._id
      });

      // Add audit log entry
      medicalRecord.addAuditLogEntry({
        user: user._id,
        action: 'update',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        details: `Added attachment: ${fileData.originalName}`
      });

      await medicalRecord.save();

      logger.info(`Attachment added to medical record ${recordId}`, {
        userId: user._id,
        recordId,
        filename: fileData.originalName
      });

      return medicalRecord;
    } catch (error) {
      logger.error(`Error adding attachment to record ${recordId}`, {
        error: error.message,
        userId: user?._id
      });
      throw error;
    }
  },

  /**
   * Remove a file attachment from a medical record
   * @param {string} recordId - Medical record ID
   * @param {string} attachmentId - Attachment ID
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Updated medical record
   */
  removeAttachment: async (recordId, attachmentId, user) => {
    try {
      const medicalRecord = await MedicalRecord.findById(recordId);

      if (!medicalRecord || medicalRecord.isDeleted) {
        throw new NotFoundError('Medical record not found');
      }

      // Check if user has write access
      const isAdmin = user.roles.some(role => role.name === 'admin');
      const isProvider = medicalRecord.provider.toString() === user._id.toString();
      const hasWriteAccess = medicalRecord.hasAccess(user._id, 'write');

      if (!isAdmin && !isProvider && !hasWriteAccess) {
        throw new AuthorizationError('You do not have permission to remove attachments from this record');
      }

      // Find the attachment
      const attachment = medicalRecord.attachments.id(attachmentId);
      if (!attachment) {
        throw new NotFoundError('Attachment not found');
      }

      // Store the file path for removal
      const filePath = attachment.path;

      // Remove the attachment from the record
      medicalRecord.attachments.pull(attachmentId);

      // Add audit log entry
      medicalRecord.addAuditLogEntry({
        user: user._id,
        action: 'update',
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        details: `Removed attachment: ${attachment.originalName}`
      });

      await medicalRecord.save();

      // Delete the actual file from storage
      try {
        await fs.unlink(filePath);
      } catch (fileError) {
        logger.warn(`Failed to delete file at ${filePath}`, {
          error: fileError.message
        });
        // Continue even if file deletion fails
      }

      logger.info(`Attachment removed from medical record ${recordId}`, {
        userId: user._id,
        recordId,
        attachmentId
      });

      return medicalRecord;
    } catch (error) {
      logger.error(`Error removing attachment from record ${recordId}`, {
        error: error.message,
        userId: user?._id
      });
      throw error;
    }
  },

  /**
   * Grant access to a medical record
   * @param {string} recordId - Medical record ID
   * @param {string} userId - User ID to grant access to
   * @param {string} accessLevel - Access level (read, write, admin)
   * @param {Object} currentUser - User granting access
   * @param {Object} options - Additional options (reason, expiration)
   * @returns {Promise<Object>} Updated medical record
   */
  grantAccess: async (recordId, userId, accessLevel, currentUser, options = {}) => {
    try {
      const { reason = null, expiresAt = null } = options;

      const medicalRecord = await MedicalRecord.findById(recordId);
      if (!medicalRecord || medicalRecord.isDeleted) {
        throw new NotFoundError('Medical record not found');
      }

      // Verify the target user exists
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        throw new NotFoundError('User not found');
      }

      // Check if current user has admin access to the record
      const isAdmin = currentUser.roles.some(role => role.name === 'admin');
      const isProvider = medicalRecord.provider.toString() === currentUser._id.toString();
      const hasAdminAccess = medicalRecord.hasAccess(currentUser._id, 'admin');

      if (!isAdmin && !isProvider && !hasAdminAccess) {
        throw new AuthorizationError('You do not have permission to share this medical record');
      }

      // Grant access
      medicalRecord.grantAccess(
        userId,
        accessLevel,
        currentUser._id,
        reason,
        expiresAt ? new Date(expiresAt) : null
      );

      // Add audit log entry
      medicalRecord.addAuditLogEntry({
        user: currentUser._id,
        action: 'share',
        ipAddress: currentUser.ipAddress,
        userAgent: currentUser.userAgent,
        details: `Granted ${accessLevel} access to user ${targetUser.email}`
      });

      await medicalRecord.save();

      logger.info(`Access granted to medical record ${recordId}`, {
        userId: currentUser._id,
        recordId,
        targetUserId: userId,
        accessLevel
      });

      return medicalRecord;
    } catch (error) {
      logger.error(`Error granting access to record ${recordId}`, {
        error: error.message,
        userId: currentUser?._id
      });
      throw error;
    }
  },

  /**
   * Revoke access to a medical record
   * @param {string} recordId - Medical record ID
   * @param {string} userId - User ID to revoke access from
   * @param {Object} currentUser - User revoking access
   * @returns {Promise<Object>} Updated medical record
   */
  revokeAccess: async (recordId, userId, currentUser) => {
    try {
      const medicalRecord = await MedicalRecord.findById(recordId);
      if (!medicalRecord || medicalRecord.isDeleted) {
        throw new NotFoundError('Medical record not found');
      }

      // Check if current user has admin access to the record
      const isAdmin = currentUser.roles.some(role => role.name === 'admin');
      const isProvider = medicalRecord.provider.toString() === currentUser._id.toString();
      const hasAdminAccess = medicalRecord.hasAccess(currentUser._id, 'admin');

      if (!isAdmin && !isProvider && !hasAdminAccess) {
        throw new AuthorizationError('You do not have permission to modify access to this medical record');
      }

      // Get user info for logging
      const targetUser = await User.findById(userId).select('email');

      // Revoke access
      medicalRecord.revokeAccess(userId);

      // Add audit log entry
      medicalRecord.addAuditLogEntry({
        user: currentUser._id,
        action: 'share',
        ipAddress: currentUser.ipAddress,
        userAgent: currentUser.userAgent,
        details: `Revoked access from user ${targetUser?.email || userId}`
      });

      await medicalRecord.save();

      logger.info(`Access revoked from medical record ${recordId}`, {
        userId: currentUser._id,
        recordId,
        targetUserId: userId
      });

      return medicalRecord;
    } catch (error) {
      logger.error(`Error revoking access from record ${recordId}`, {
        error: error.message,
        userId: currentUser?._id
      });
      throw error;
    }
  },

  /**
   * Get a patient's medical records with filtering
   * @param {string} patientId - Patient ID
   * @param {Object} filters - Filter criteria
   * @param {Object} user - Current user
   * @returns {Promise<Object>} Paginated medical records
   */
  getPatientMedicalRecords: async (patientId, filters = {}, user) => {
    try {
      const {
        category,
        startDate,
        endDate,
        searchTerm,
        page = 1,
        limit = 20,
        sortBy = 'recordDate',
        sortOrder = 'desc'
      } = filters;

      // Verify patient exists
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Check if user has permission to view patient records
      const isAdmin = user.roles.some(role => role.name === 'admin');
      const isProvider = user.roles.some(role => ['doctor', 'nurse'].includes(role.name));
      const isPatient = user._id.toString() === patientId;

      if (!isAdmin && !isProvider && !isPatient) {
        throw new AuthorizationError('You do not have permission to view this patient\'s records');
      }

      // Build query
      let query = MedicalRecord.find({ patient: patientId, isDeleted: false });

      // Apply filters
      if (category) {
        query = query.byCategory(category);
      }

      if (startDate && endDate) {
        query = query.byDateRange(new Date(startDate), new Date(endDate));
      }

      if (searchTerm) {
        query = query.find({ $text: { $search: searchTerm } });
      }

      // Count total matching documents
      const totalCount = await MedicalRecord.countDocuments(query);

      // Apply pagination and sorting
      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      query = query
        .sort({ [sortBy]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('provider', 'firstName lastName role');

      // Execute query
      const records = await query.exec();

      // Add audit log entry for each record viewed
      if (records.length > 0) {
        // Bulk insert audit log entries for all records viewed
        const bulkOps = records.map(record => {
          return {
            updateOne: {
              filter: { _id: record._id },
              update: {
                $push: {
                  auditLog: {
                    user: user._id,
                    action: 'view',
                    timestamp: Date.now(),
                    ipAddress: user.ipAddress,
                    userAgent: user.userAgent,
                    details: 'Viewed in patient record list'
                  }
                }
              }
            }
          };
        });

        // Execute the bulk operations
        await MedicalRecord.bulkWrite(bulkOps);

        logger.info(`Medical records for patient ${patientId} accessed`, {
          userId: user._id,
          patientId,
          count: records.length
        });
      }

      // Return paginated results
      return {
        records,
        pagination: {
          totalRecords: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: page,
          perPage: limit
        }
      };
    } catch (error) {
      logger.error(`Error retrieving medical records for patient ${patientId}`, {
        error: error.message,
        userId: user?._id
      });
      throw error;
    }
  },

  /**
   * Get medical records for a time period (timeline view)
   * @param {string} patientId - Patient ID
   * @param {Object} timelineParams - Timeline parameters
   * @param {Object} user - Current user
   * @returns {Promise<Array>} Medical records for the timeline
   */
  getMedicalRecordTimeline: async (patientId, timelineParams = {}, user) => {
    try {
      const {
        startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
        endDate = new Date(),
        categories = Object.values(RECORD_CATEGORIES)
      } = timelineParams;

      // Verify patient exists
      const patient = await Patient.findById(patientId);
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Check if user has permission to view patient records
      const isAdmin = user.roles.some(role => role.name === 'admin');
      const isProvider = user.roles.some(role => ['doctor', 'nurse'].includes(role.name));
      const isPatient = user._id.toString() === patientId;

      if (!isAdmin && !isProvider && !isPatient) {
        throw new AuthorizationError('You do not have permission to view this patient\'s records');
      }

      // Query for timeline records
      const records = await MedicalRecord.find({
        patient: patientId,
        category: { $in: categories },
        recordDate: { $gte: startDate, $lte: endDate },
        isDeleted: false
      })
      .sort({ recordDate: 1 })
      .select('title category recordDate provider')
      .populate('provider', 'firstName lastName role')
      .exec();

      // Log the access
      logger.info(`Medical record timeline for patient ${patientId} accessed`, {
        userId: user._id,
        patientId,
        startDate,
        endDate
      });

      // Group records by month for timeline view
      const timeline = records.reduce((result, record) => {
        const date = new Date(record.recordDate);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!result[monthYear]) {
          result[monthYear] = [];
        }
        
        result[monthYear].push({
          id: record._id,
          title: record.title,
          category: record.category,
          date: record.recordDate,
          provider: record.provider ? `${record.provider.firstName} ${record.provider.lastName}` : 'Unknown Provider'
        });
        
        return result;
      }, {});

      return {
        timeline,
        timeRange: {
          start: startDate,
          end: endDate
        },
        categories: categories
      };
    } catch (error) {
      logger.error(`Error retrieving medical record timeline for patient ${patientId}`, {
        error: error.message,
        userId: user?._id
      });
      throw error;
    }
  }
};

module.exports = medicalRecordService;
const asyncHandler = require('../utils/async-handler.util');
const patientProfileService = require('../services/patient-profile.service');
const profileVersionService = require('../services/profile-version.service');
const { ResponseUtil } = require('../utils/response.util');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common doc and image formats
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, PNG, DOC, DOCX, and TXT are allowed.'));
    }
  }
});

/**
 * Controller for patient profile management endpoints
 */
const patientProfileController = {
  /**
   * Get patient profile
   * @route GET /api/patients/:id/profile
   */
  getProfile: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const requestingUser = req.user;
      
      const profile = await patientProfileService.getProfile(patientId, requestingUser);
      
      return ResponseUtil.success(res, {
        data: profile
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      if (error instanceof AuthorizationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          403,
          'FORBIDDEN'
        );
      }
      
      logger.error('Failed to get patient profile', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to retrieve patient profile', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Update patient profile
   * @route PUT /api/patients/:id/profile
   */
  updateProfile: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const updateData = req.body;
      const requestingUser = req.user;
      const updateReason = req.body.updateReason || '';
      
      // Remove updateReason from the data to update
      delete updateData.updateReason;
      
      const updatedProfile = await patientProfileService.updateProfile(
        patientId,
        updateData,
        requestingUser,
        updateReason
      );
      
      return ResponseUtil.success(res, {
        message: 'Patient profile updated successfully',
        data: updatedProfile
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      if (error instanceof ValidationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          400,
          'VALIDATION_ERROR'
        );
      }
      
      if (error instanceof AuthorizationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          403,
          'FORBIDDEN'
        );
      }
      
      logger.error('Failed to update patient profile', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to update patient profile', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Record patient vital signs
   * @route POST /api/patients/:id/vitals
   */
  recordVitalSigns: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const vitalData = req.body;
      const requestingUser = req.user;
      
      const updatedVitals = await patientProfileService.recordVitalSigns(
        patientId,
        vitalData,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        message: 'Vital signs recorded successfully',
        data: updatedVitals
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      logger.error('Failed to record vital signs', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to record vital signs', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Add allergy to patient profile
   * @route POST /api/patients/:id/allergies
   */
  addAllergy: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const allergyData = req.body;
      const requestingUser = req.user;
      
      const updatedAllergies = await patientProfileService.addAllergy(
        patientId,
        allergyData,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        message: 'Allergy added successfully',
        data: updatedAllergies
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      if (error instanceof ValidationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          400,
          'VALIDATION_ERROR'
        );
      }
      
      logger.error('Failed to add allergy', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to add allergy', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Update an existing allergy
   * @route PUT /api/patients/:id/allergies/:allergyId
   */
  updateAllergy: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const allergyId = req.params.allergyId;
      const allergyData = req.body;
      const requestingUser = req.user;
      
      const updatedAllergies = await patientProfileService.updateAllergy(
        patientId,
        allergyId,
        allergyData,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        message: 'Allergy updated successfully',
        data: updatedAllergies
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      logger.error('Failed to update allergy', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to update allergy', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Add medication to patient profile
   * @route POST /api/patients/:id/medications
   */
  addMedication: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const medicationData = req.body;
      const requestingUser = req.user;
      
      const updatedMedications = await patientProfileService.addMedication(
        patientId,
        medicationData,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        message: 'Medication added successfully',
        data: updatedMedications
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      if (error instanceof ValidationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          400,
          'VALIDATION_ERROR'
        );
      }
      
      logger.error('Failed to add medication', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to add medication', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Add medical history item to patient profile
   * @route POST /api/patients/:id/medical-history
   */
  addMedicalHistory: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const historyData = req.body;
      const requestingUser = req.user;
      
      const updatedHistory = await patientProfileService.addMedicalHistory(
        patientId,
        historyData,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        message: 'Medical history added successfully',
        data: updatedHistory
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      logger.error('Failed to add medical history', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to add medical history', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Add family history item to patient profile
   * @route POST /api/patients/:id/family-history
   */
  addFamilyHistory: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const familyHistoryData = req.body;
      const requestingUser = req.user;
      
      const updatedFamilyHistory = await patientProfileService.addFamilyHistory(
        patientId,
        familyHistoryData,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        message: 'Family medical history added successfully',
        data: updatedFamilyHistory
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      logger.error('Failed to add family history', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to add family medical history', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Update lifestyle information
   * @route PUT /api/patients/:id/lifestyle
   */
  updateLifestyle: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const lifestyleData = req.body;
      const requestingUser = req.user;
      
      const updatedLifestyle = await patientProfileService.updateLifestyle(
        patientId,
        lifestyleData,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        message: 'Lifestyle information updated successfully',
        data: updatedLifestyle
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      logger.error('Failed to update lifestyle information', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to update lifestyle information', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Upload document to patient profile
   * Handle file upload with multer middleware
   */
  uploadDocument: [
    upload.single('file'),
    asyncHandler(async (req, res) => {
      try {
        const patientId = req.params.id;
        const file = req.file;
        const documentData = req.body;
        const requestingUser = req.user;
        
        if (!file) {
          return ResponseUtil.error(
            res,
            'No file uploaded',
            400,
            'VALIDATION_ERROR'
          );
        }
        
        const documentMetadata = await patientProfileService.uploadDocument(
          patientId,
          file,
          documentData,
          requestingUser
        );
        
        return ResponseUtil.success(res, {
          message: 'Document uploaded successfully',
          data: documentMetadata
        });
      } catch (error) {
        // Ensure temp file is cleaned up on error
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {
            logger.error('Failed to clean up temp file', { error: e.message });
          }
        }
        
        if (error instanceof NotFoundError) {
          return ResponseUtil.error(
            res, 
            error.message, 
            404,
            'NOT_FOUND'
          );
        }
        
        logger.error('Failed to upload document', { error: error.message });
        return ResponseUtil.error(
          res, 
          'Failed to upload document', 
          500,
          'SERVER_ERROR'
        );
      }
    })
  ],
  
  /**
   * Download document from patient profile
   * @route GET /api/patients/:id/documents/:documentId
   */
  getDocument: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const documentId = req.params.documentId;
      const requestingUser = req.user;
      
      const fileInfo = await patientProfileService.getDocument(
        patientId,
        documentId,
        requestingUser
      );
      
      // Set appropriate headers and stream the file
      res.setHeader('Content-Type', fileInfo.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.filename}"`);
      
      const fileStream = fs.createReadStream(fileInfo.filePath);
      fileStream.pipe(res);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      if (error instanceof AuthorizationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          403,
          'FORBIDDEN'
        );
      }
      
      logger.error('Failed to retrieve document', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to retrieve document', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Get patient profile version history
   * @route GET /api/patients/:id/versions
   */
  getProfileVersionHistory: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const requestingUser = req.user;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      const versionHistory = await patientProfileService.getProfileVersionHistory(
        patientId,
        { page, limit },
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        data: versionHistory.versions,
        pagination: versionHistory.pagination
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      if (error instanceof AuthorizationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          403,
          'FORBIDDEN'
        );
      }
      
      logger.error('Failed to get profile version history', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to retrieve profile version history', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Compare two versions of a patient profile
   * @route GET /api/patients/:id/versions/compare
   */
  compareProfileVersions: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const requestingUser = req.user;
      const versionA = parseInt(req.query.versionA);
      const versionB = parseInt(req.query.versionB);
      
      if (isNaN(versionA) || isNaN(versionB)) {
        return ResponseUtil.error(
          res,
          'Both versionA and versionB must be valid numbers',
          400,
          'VALIDATION_ERROR'
        );
      }
      
      const comparison = await patientProfileService.compareProfileVersions(
        patientId,
        versionA,
        versionB,
        requestingUser
      );
      
      return ResponseUtil.success(res, {
        data: comparison
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          404,
          'NOT_FOUND'
        );
      }
      
      if (error instanceof AuthorizationError) {
        return ResponseUtil.error(
          res, 
          error.message, 
          403,
          'FORBIDDEN'
        );
      }
      
      logger.error('Failed to compare profile versions', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to compare profile versions', 
        500,
        'SERVER_ERROR'
      );
    }
  }),
  
  /**
   * Get history of a specific field
   * @route GET /api/patients/:id/field-history
   */
  getFieldHistory: asyncHandler(async (req, res) => {
    try {
      const patientId = req.params.id;
      const field = req.query.field;
      const requestingUser = req.user;
      
      if (!field) {
        return ResponseUtil.error(
          res,
          'Field parameter is required',
          400,
          'VALIDATION_ERROR'
        );
      }
      
      const fieldHistory = await profileVersionService.getFieldHistory(
        patientId,
        field
      );
      
      return ResponseUtil.success(res, {
        data: fieldHistory
      });
    } catch (error) {
      logger.error('Failed to get field history', { error: error.message });
      return ResponseUtil.error(
        res, 
        'Failed to retrieve field history', 
        500,
        'SERVER_ERROR'
      );
    }
  })
};

module.exports = patientProfileController;
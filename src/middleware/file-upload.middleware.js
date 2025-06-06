// src/middleware/file-upload.middleware.js

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

// Ensure upload directories exist
const createUploadDirs = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  const medicalRecordsDir = path.join(uploadDir, 'medical-records');
  
  // Create directories if they don't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  
  if (!fs.existsSync(medicalRecordsDir)) {
    fs.mkdirSync(medicalRecordsDir);
  }
  
  return { uploadDir, medicalRecordsDir };
};

// Create required directories
const { medicalRecordsDir } = createUploadDirs();

// Configure storage for medical files
const medicalStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, medicalRecordsDir);
  },
  filename: function (req, file, cb) {
    // Generate a secure random filename to prevent path traversal attacks
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileExt = path.extname(file.originalname);
    cb(null, `${Date.now()}-${randomName}${fileExt}`);
  }
});

// File filter for medical documents and images
const medicalFileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 
    // Documents
    'application/pdf', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Text
    'text/plain',
    // DICOM medical images
    'application/dicom'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError(`Unsupported file type: ${file.mimetype}. Please upload a valid document or image file.`), false);
  }
};

// Create multer upload instances
const uploadMedicalFile = multer({ 
  storage: medicalStorage,
  fileFilter: medicalFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 
    files: 1  // Only allow 1 file per upload
  }
}).single('file');

// Wrap multer middleware to handle errors
const handleMulterErrors = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          // Multer-specific errors
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ValidationError('File size limit exceeded. Maximum file size is 10MB.'));
          } else {
            return next(new ValidationError(`File upload error: ${err.message}`));
          }
        } else {
          // Other errors
          return next(err);
        }
      }
      
      logger.info('File upload successful', {
        filename: req.file?.filename,
        originalName: req.file?.originalname,
        size: req.file?.size,
        userId: req.user?._id
      });
      
      next();
    });
  };
};

// Export middlewares with proper error handling
module.exports = {
  uploadMedicalFile: handleMulterErrors(uploadMedicalFile)
};
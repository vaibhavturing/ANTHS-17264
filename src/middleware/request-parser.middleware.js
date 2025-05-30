/**
 * Healthcare Management Application
 * Request Parser Middleware
 * 
 * Configures middleware for parsing and processing request bodies
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Configure JSON Body Parser
 * @returns {Function} Configured JSON parser middleware
 */
const jsonParserMiddleware = () => {
  return express.json({ 
    limit: '10kb' // Limit JSON payloads to 10KB
  });
};

/**
 * Configure URL Encoded Body Parser
 * @returns {Function} Configured URL encoded parser middleware
 */
const urlencodedParserMiddleware = () => {
  return express.urlencoded({ 
    extended: true, // Allow complex objects
    limit: '10kb' // Limit URL encoded payloads to 10KB
  });
};

/**
 * Configure Multer for file uploads
 */
const configureFileUploads = () => {
  // Create upload directory if it doesn't exist
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Determine subdirectory based on file type
      let uploadSubDir = 'misc';
      
      if (file.mimetype.startsWith('image/')) {
        uploadSubDir = 'images';
      } else if (file.mimetype === 'application/pdf') {
        uploadSubDir = 'documents';
      } else if (file.mimetype.startsWith('video/')) {
        uploadSubDir = 'videos';
      }
      
      const fullUploadPath = path.join(uploadDir, uploadSubDir);
      
      // Create subdirectory if it doesn't exist
      if (!fs.existsSync(fullUploadPath)) {
        fs.mkdirSync(fullUploadPath, { recursive: true });
      }
      
      cb(null, fullUploadPath);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const extension = path.extname(file.originalname);
      const filename = `${uuidv4()}${extension}`;
      cb(null, filename);
    }
  });

  // File filter for security
  const fileFilter = (req, file, cb) => {
    // Define allowed MIME types
    const allowedMimeTypes = [
      'image/jpeg', 
      'image/png', 
      'application/pdf', 
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      // Accept file
      cb(null, true);
    } else {
      // Reject file
      cb(new Error(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
    }
  };

  // Create multer instance with configuration
  return multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max file size
      files: 5 // Max 5 files per upload
    }
  });
};

module.exports = {
  jsonParserMiddleware,
  urlencodedParserMiddleware,
  fileUpload: configureFileUploads()
};
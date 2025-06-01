/**
 * Healthcare Management Application
 * Request Parser Middleware
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * Configure JSON Body Parser
 */
const jsonParserMiddleware = () => {
  return express.json({ 
    limit: '10kb' // Limit JSON payloads to 10KB
  });
};

/**
 * Configure URL Encoded Body Parser
 */
const urlencodedParserMiddleware = () => {
  return express.urlencoded({ 
    extended: true,
    limit: '10kb'
  });
};

/**
 * Configure Multer for file uploads
 */
const configureFileUploads = () => {
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      let uploadSubDir = 'misc';
      if (file.mimetype.startsWith('image/')) {
        uploadSubDir = 'images';
      } else if (file.mimetype === 'application/pdf') {
        uploadSubDir = 'documents';
      } else if (file.mimetype.startsWith('video/')) {
        uploadSubDir = 'videos';
      }

      const fullUploadPath = path.join(uploadDir, uploadSubDir);
      if (!fs.existsSync(fullUploadPath)) {
        fs.mkdirSync(fullUploadPath, { recursive: true });
      }

      cb(null, fullUploadPath);
    },
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname);
      const filename = `${uuidv4()}${extension}`;
      cb(null, filename);
    }
  });

  const fileFilter = (req, file, cb) => {
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
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 5
    }
  });
};

module.exports = {
  jsonParserMiddleware,
  urlencodedParserMiddleware,
  fileUpload: configureFileUploads()
};

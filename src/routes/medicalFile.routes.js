const express = require('express');
const router = express.Router();
const medicalFileController = require('../controllers/medicalFile.controller');
const auth = require('../middleware/auth.middleware');
const fileStorageService = require('../services/fileStorage.service');

// Get file upload middleware
const upload = fileStorageService.getFileUploadMiddleware();

// Get file tags
router.get(
  '/tags',
  auth('read:file_tags'),
  medicalFileController.getFileTags
);

// Create file tag
router.post(
  '/tags',
  auth('create:file_tags'),
  medicalFileController.createFileTag
);

// Upload file
router.post(
  '/upload',
  auth('upload:medical_files'),
  upload.single('file'),
  medicalFileController.uploadFile
);

// Get files for patient
router.get(
  '/patient/:patientId',
  auth('read:medical_files'),
  medicalFileController.getPatientFiles
);

// Get single file
router.get(
  '/:fileId',
  auth('read:medical_files'),
  medicalFileController.getFile
);

// Delete file
router.delete(
  '/:fileId',
  auth('delete:medical_files'),
  medicalFileController.deleteFile
);

// Update file tags
router.patch(
  '/:fileId/tags',
  auth('update:medical_files'),
  medicalFileController.updateFileTags
);

module.exports = router;
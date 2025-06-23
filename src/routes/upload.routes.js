/**
 * Upload Routes
 * Routes for handling file uploads
 */

const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { uploadSingle, uploadMultiple } = require('../middleware/upload.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/authorization.middleware');

/**
 * @route POST /api/upload/file
 * @description Upload a single file
 * @access Private
 */
router.post(
  '/file',
  authenticate,
  authorize(['upload:create']),
  uploadSingle('file'),
  uploadController.uploadFile
);

/**
 * @route POST /api/upload/files
 * @description Upload multiple files
 * @access Private
 */
router.post(
  '/files',
  authenticate,
  authorize(['upload:create']),
  uploadMultiple('files', 5),
  uploadController.uploadMultipleFiles
);

/**
 * @route POST /api/upload/process
 * @description Process existing image
 * @access Private
 */
router.post(
  '/process',
  authenticate,
  authorize(['upload:create']),
  uploadController.processExistingImage
);

/**
 * @route POST /api/upload/responsive
 * @description Create responsive image versions
 * @access Private
 */
router.post(
  '/responsive',
  authenticate,
  authorize(['upload:create']),
  uploadController.createResponsiveImages
);

module.exports = router;
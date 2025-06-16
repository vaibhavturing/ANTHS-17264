const express = require('express');
const router = express.Router();
const noteTemplateController = require('../controllers/noteTemplate.controller');
const authMiddleware = require('../middleware/auth.middleware');
const authorizationMiddleware = require('../middleware/authorization.middleware');
const noteTemplateValidator = require('../validators/noteTemplate.validator');
const validate = require('../middleware/validation.middleware');

// Get all templates
router.get(
  '/',
  authMiddleware.authenticate,
  noteTemplateController.getTemplates
);

// Get template by ID
router.get(
  '/:templateId',
  authMiddleware.authenticate,
  noteTemplateController.getTemplateById
);

// Create a new template
router.post(
  '/',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin', 'doctor']),
  validate(noteTemplateValidator.createTemplateSchema),
  noteTemplateController.createTemplate
);

// Update a template
router.put(
  '/:templateId',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin', 'doctor']),
  validate(noteTemplateValidator.updateTemplateSchema),
  noteTemplateController.updateTemplate
);

// Set as default template
router.put(
  '/:templateId/set-default',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin']),
  noteTemplateController.setAsDefault
);

// Clone a template
router.post(
  '/:templateId/clone',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin', 'doctor']),
  validate(noteTemplateValidator.cloneTemplateSchema),
  noteTemplateController.cloneTemplate
);

// Delete a template
router.delete(
  '/:templateId',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin']),
  noteTemplateController.deleteTemplate
);

// Initialize default templates
router.post(
  '/initialize-defaults',
  authMiddleware.authenticate,
  authorizationMiddleware.authorize(['admin']),
  noteTemplateController.initializeDefaultTemplates
);

module.exports = router;
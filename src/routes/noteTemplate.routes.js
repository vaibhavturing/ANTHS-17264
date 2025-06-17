const express = require('express');
const router = express.Router();
const noteTemplateController = require('../controllers/noteTemplate.controller');
const authMiddleware = require('../middleware/auth.middleware');
const authorizationMiddleware = require('../middleware/authorization.middleware'); // Updated import

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Get all templates
router.get('/', noteTemplateController.getAllTemplates);

// Get template by ID
router.get('/:id', noteTemplateController.getTemplateById);

// Create a new template
router.post('/', 
  authorizationMiddleware.checkRole(['doctor', 'admin']), // Updated to use proper import
  noteTemplateController.createTemplate
);

// Update template
router.put('/:id', 
  authorizationMiddleware.checkRole(['doctor', 'admin']), // Updated to use proper import
  noteTemplateController.updateTemplate
);

// Delete template
router.delete('/:id', 
  authorizationMiddleware.checkRole(['doctor', 'admin']), // Updated to use proper import
  noteTemplateController.deleteTemplate
);

// Clone template
router.post('/:id/clone', 
  authorizationMiddleware.checkRole(['doctor', 'admin']), // Updated to use proper import
  noteTemplateController.cloneTemplate
);

// Create default templates (admin only)
router.post('/create-defaults', 
  authorizationMiddleware.checkRole(['admin']), // Updated to use proper import
  noteTemplateController.createDefaultTemplates
);

module.exports = router;
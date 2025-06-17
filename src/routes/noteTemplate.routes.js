const express = require('express');
const router = express.Router();
const noteTemplateController = require('../controllers/noteTemplate.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { checkRole } = require('../middleware/authorization.middleware');

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Get all templates
router.get('/', noteTemplateController.getAllTemplates);

// Get template by ID
router.get('/:id', noteTemplateController.getTemplateById);

// Create a new template
router.post('/', 
  checkRole(['doctor', 'admin']), 
  noteTemplateController.createTemplate
);

// Update template
router.put('/:id', 
  checkRole(['doctor', 'admin']), 
  noteTemplateController.updateTemplate
);

// Delete template
router.delete('/:id', 
  checkRole(['doctor', 'admin']), 
  noteTemplateController.deleteTemplate
);

// Clone template
router.post('/:id/clone', 
  checkRole(['doctor', 'admin']), 
  noteTemplateController.cloneTemplate
);

// Create default templates (admin only)
router.post('/create-defaults', 
  checkRole(['admin']), 
  noteTemplateController.createDefaultTemplates
);

module.exports = router;
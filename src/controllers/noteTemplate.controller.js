const noteTemplateService = require('../services/noteTemplate.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { templateSchemas } = require('../validators/noteTemplate.validator');
const validationMiddleware = require('../middleware/validate.middleware');
const logger = require('../utils/logger');

/**
 * Create a new note template
 * @route POST /api/note-templates
 * @access Private (Doctors, Admins)
 */
const createTemplate = asyncHandler(async (req, res) => {
  // Add the logged-in user as the creator
  const templateData = {
    ...req.body,
    createdBy: req.user._id
  };
  
  const template = await noteTemplateService.createTemplate(templateData);
  return ResponseUtil.success(res, { 
    message: 'Note template created successfully', 
    template 
  }, 201);
});

/**
 * Get all note templates
 * @route GET /api/note-templates
 * @access Private
 */
const getAllTemplates = asyncHandler(async (req, res) => {
  const templates = await noteTemplateService.getAllTemplates(req.query);
  return ResponseUtil.success(res, { templates });
});

/**
 * Get template by ID
 * @route GET /api/note-templates/:id
 * @access Private
 */
const getTemplateById = asyncHandler(async (req, res) => {
  const template = await noteTemplateService.getTemplateById(req.params.id);
  return ResponseUtil.success(res, { template });
});

/**
 * Update a template
 * @route PUT /api/note-templates/:id
 * @access Private (Creator or Admin)
 */
const updateTemplate = asyncHandler(async (req, res) => {
  // Check if user is admin for adminOverride capability
  if (req.user.role === 'admin') {
    req.body.adminOverride = true;
  }
  
  const template = await noteTemplateService.updateTemplate(req.params.id, req.body);
  return ResponseUtil.success(res, { 
    message: 'Template updated successfully', 
    template 
  });
});

/**
 * Delete a template
 * @route DELETE /api/note-templates/:id
 * @access Private (Creator or Admin)
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const result = await noteTemplateService.deleteTemplate(req.params.id);
  return ResponseUtil.success(res, { 
    message: result.message 
  });
});

/**
 * Clone a template
 * @route POST /api/note-templates/:id/clone
 * @access Private (Doctors, Admins)
 */
const cloneTemplate = asyncHandler(async (req, res) => {
  const modifications = {
    ...req.body,
    createdBy: req.user._id
  };
  
  const template = await noteTemplateService.cloneTemplate(req.params.id, modifications);
  return ResponseUtil.success(res, { 
    message: 'Template cloned successfully', 
    template 
  }, 201);
});

/**
 * Create default system templates
 * @route POST /api/note-templates/create-defaults
 * @access Private (Admin only)
 */
const createDefaultTemplates = asyncHandler(async (req, res) => {
  const templates = await noteTemplateService.createDefaultTemplates(req.user._id);
  return ResponseUtil.success(res, { 
    message: 'Default templates created successfully', 
    count: templates.length 
  }, 201);
});

module.exports = {
  createTemplate: [validationMiddleware(templateSchemas.create), createTemplate],
  getAllTemplates: [validationMiddleware(templateSchemas.getAll), getAllTemplates],
  getTemplateById,
  updateTemplate: [validationMiddleware(templateSchemas.update), updateTemplate],
  deleteTemplate,
  cloneTemplate,
  createDefaultTemplates
};
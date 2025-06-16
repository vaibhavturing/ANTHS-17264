const noteTemplateService = require('../services/noteTemplate.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');

/**
 * Controller for note templates
 */
const noteTemplateController = {
  /**
   * Create a new note template
   * @route POST /api/note-templates
   */
  createTemplate: asyncHandler(async (req, res) => {
    const templateData = {
      ...req.body,
      createdBy: req.user.userId,
      lastModifiedBy: req.user.userId
    };
    
    const template = await noteTemplateService.createTemplate(templateData);
    
    return ResponseUtil.success(res, {
      message: 'Template created successfully',
      template
    }, 201);
  }),

  /**
   * Get template by ID
   * @route GET /api/note-templates/:templateId
   */
  getTemplateById: asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const template = await noteTemplateService.getTemplateById(templateId);
    
    return ResponseUtil.success(res, { template });
  }),

  /**
   * Get all templates
   * @route GET /api/note-templates
   */
  getTemplates: asyncHandler(async (req, res) => {
    const { templateType, specialty, isActive } = req.query;
    
    const filters = {};
    if (templateType) filters.templateType = templateType;
    if (specialty) filters.specialty = specialty;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const templates = await noteTemplateService.getTemplates(filters);
    
    return ResponseUtil.success(res, { templates });
  }),

  /**
   * Update a template
   * @route PUT /api/note-templates/:templateId
   */
  updateTemplate: asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const updateData = {
      ...req.body,
      lastModifiedBy: req.user.userId
    };
    
    const template = await noteTemplateService.updateTemplate(templateId, updateData);
    
    return ResponseUtil.success(res, {
      message: 'Template updated successfully',
      template
    });
  }),

  /**
   * Set a template as default for its type
   * @route PUT /api/note-templates/:templateId/set-default
   */
  setAsDefault: asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const template = await noteTemplateService.setAsDefault(templateId);
    
    return ResponseUtil.success(res, {
      message: 'Template set as default successfully',
      template
    });
  }),

  /**
   * Delete a template
   * @route DELETE /api/note-templates/:templateId
   */
  deleteTemplate: asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const result = await noteTemplateService.deleteTemplate(templateId);
    
    return ResponseUtil.success(res, result);
  }),

  /**
   * Clone a template
   * @route POST /api/note-templates/:templateId/clone
   */
  cloneTemplate: asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const { name } = req.body;
    
    const template = await noteTemplateService.cloneTemplate(
      templateId,
      req.user.userId,
      { name }
    );
    
    return ResponseUtil.success(res, {
      message: 'Template cloned successfully',
      template
    }, 201);
  }),

  /**
   * Initialize default templates
   * @route POST /api/note-templates/initialize-defaults
   */
  initializeDefaultTemplates: asyncHandler(async (req, res) => {
    const result = await noteTemplateService.initializeDefaultTemplates(req.user.userId);
    
    return ResponseUtil.success(res, result);
  })
};

module.exports = noteTemplateController;
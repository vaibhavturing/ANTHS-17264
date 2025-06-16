const NoteTemplate = require('../models/noteTemplate.model');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for managing note templates
 */
const noteTemplateService = {
  /**
   * Create a new note template
   * @param {Object} templateData - Template data
   * @returns {Promise<Object>} Created template
   */
  createTemplate: async (templateData) => {
    try {
      const template = new NoteTemplate(templateData);
      await template.save();
      return template;
    } catch (error) {
      logger.error('Error creating note template', {
        error: error.message,
        templateData: templateData.name
      });
      throw error;
    }
  },

  /**
   * Get template by ID
   * @param {String} templateId - Template ID
   * @returns {Promise<Object>} Template data
   */
  getTemplateById: async (templateId) => {
    try {
      const template = await NoteTemplate.findById(templateId)
        .populate('createdBy', 'firstName lastName')
        .populate('lastModifiedBy', 'firstName lastName');
      
      if (!template) {
        throw new NotFoundError('Template not found');
      }
      
      return template;
    } catch (error) {
      logger.error('Error fetching template', {
        error: error.message,
        templateId
      });
      throw error;
    }
  },

  /**
   * Get all templates, with optional filtering
   * @param {Object} filters - Optional filters (templateType, specialty, isActive)
   * @returns {Promise<Array>} List of templates
   */
  getTemplates: async (filters = {}) => {
    try {
      const query = {};
      
      if (filters.templateType) {
        query.templateType = filters.templateType;
      }
      
      if (filters.specialty) {
        query.specialty = filters.specialty;
      }
      
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      const templates = await NoteTemplate.find(query)
        .select('name description templateType specialty isDefault isActive')
        .sort({ templateType: 1, name: 1 });
      
      return templates;
    } catch (error) {
      logger.error('Error fetching templates', {
        error: error.message,
        filters
      });
      throw error;
    }
  },

  /**
   * Update a template
   * @param {String} templateId - Template ID
   * @param {Object} updateData - Template data to update
   * @returns {Promise<Object>} Updated template
   */
  updateTemplate: async (templateId, updateData) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Template not found');
      }
      
      // Don't allow changing the template type once created
      if (updateData.templateType && updateData.templateType !== template.templateType) {
        throw new ValidationError('Template type cannot be changed');
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        template[key] = updateData[key];
      });
      
      await template.save();
      return template;
    } catch (error) {
      logger.error('Error updating template', {
        error: error.message,
        templateId
      });
      throw error;
    }
  },

  /**
   * Set a template as default for its type
   * @param {String} templateId - Template ID
   * @returns {Promise<Object>} Updated template
   */
  setAsDefault: async (templateId) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Template not found');
      }
      
      // First, unset any existing defaults of this type
      await NoteTemplate.updateMany(
        { 
          templateType: template.templateType,
          isDefault: true 
        },
        { 
          isDefault: false 
        }
      );
      
      // Then set this one as default
      template.isDefault = true;
      await template.save();
      
      return template;
    } catch (error) {
      logger.error('Error setting template as default', {
        error: error.message,
        templateId
      });
      throw error;
    }
  },

  /**
   * Delete a template (soft delete by setting isActive to false)
   * @param {String} templateId - Template ID
   * @returns {Promise<Object>} Deleted template
   */
  deleteTemplate: async (templateId) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Template not found');
      }
      
      if (template.isDefault) {
        throw new ValidationError('Cannot delete a default template');
      }
      
      template.isActive = false;
      await template.save();
      
      return { success: true, message: 'Template deleted successfully' };
    } catch (error) {
      logger.error('Error deleting template', {
        error: error.message,
        templateId
      });
      throw error;
    }
  },

  /**
   * Clone a template
   * @param {String} templateId - Template ID to clone
   * @param {String} userId - User ID creating the clone
   * @param {Object} overrideData - Data to override in the cloned template
   * @returns {Promise<Object>} Cloned template
   */
  cloneTemplate: async (templateId, userId, overrideData = {}) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Template not found');
      }
      
      // Create a clean template object without _id and other MongoDB-specific fields
      const templateData = template.toObject();
      delete templateData._id;
      delete templateData.id;
      delete templateData.createdAt;
      delete templateData.updatedAt;
      delete templateData.__v;
      
      // Apply overrides
      const clonedTemplate = {
        ...templateData,
        ...overrideData,
        name: overrideData.name || `${templateData.name} (Copy)`,
        createdBy: userId,
        lastModifiedBy: userId,
        isDefault: false // Cloned templates are never default
      };
      
      const newTemplate = new NoteTemplate(clonedTemplate);
      await newTemplate.save();
      
      return newTemplate;
    } catch (error) {
      logger.error('Error cloning template', {
        error: error.message,
        templateId
      });
      throw error;
    }
  },

  /**
   * Initialize default templates
   * @param {String} userId - Admin user ID
   * @returns {Promise<void>}
   */
  initializeDefaultTemplates: async (userId) => {
    try {
      await NoteTemplate.createDefaultTemplates(userId);
      return { success: true, message: 'Default templates initialized successfully' };
    } catch (error) {
      logger.error('Error initializing default templates', {
        error: error.message
      });
      throw error;
    }
  }
};

module.exports = noteTemplateService;
const NoteTemplate = require('../models/noteTemplate.model');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * Service for managing clinical note templates
 */
const noteTemplateService = {
  /**
   * Create a new note template
   * @param {Object} templateData - Data for the new template
   * @returns {Promise<Object>} Created template
   */
  createTemplate: async (templateData) => {
    try {
      const template = new NoteTemplate(templateData);
      await template.save();
      
      logger.info(`Note template created: ${template._id}`, { templateName: template.name });
      return template;
    } catch (error) {
      logger.error('Error creating note template', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Get all note templates
   * @param {Object} filters - Filter criteria
   * @returns {Promise<Array>} List of templates
   */
  getAllTemplates: async (filters = {}) => {
    try {
      const query = { isActive: true };
      
      // Apply filters if provided
      if (filters.type) query.type = filters.type;
      if (filters.specialtyRelevance) query.specialtyRelevance = filters.specialtyRelevance;
      if (filters.createdBy) query.createdBy = filters.createdBy;
      
      const templates = await NoteTemplate.find(query);
      return templates;
    } catch (error) {
      logger.error('Error retrieving note templates', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Get template by ID
   * @param {string} templateId - ID of the template
   * @returns {Promise<Object>} Template data
   */
  getTemplateById: async (templateId) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Note template not found');
      }
      
      return template;
    } catch (error) {
      logger.error('Error retrieving note template', { 
        error: error.message, 
        templateId 
      });
      throw error;
    }
  },
  
  /**
   * Update a template
   * @param {string} templateId - ID of the template to update
   * @param {Object} updateData - New template data
   * @returns {Promise<Object>} Updated template
   */
  updateTemplate: async (templateId, updateData) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Note template not found');
      }
      
      // Prevent updating system templates unless by admin
      if (template.isSystemTemplate && !updateData.adminOverride) {
        throw new BadRequestError('Cannot modify system templates');
      }
      
      // Remove adminOverride field before updating
      if (updateData.adminOverride) {
        delete updateData.adminOverride;
      }
      
      Object.assign(template, updateData);
      await template.save();
      
      logger.info(`Note template updated: ${template._id}`, { templateName: template.name });
      return template;
    } catch (error) {
      logger.error('Error updating note template', { 
        error: error.message, 
        templateId 
      });
      throw error;
    }
  },
  
  /**
   * Delete a template (soft delete by setting isActive to false)
   * @param {string} templateId - ID of the template to delete
   * @returns {Promise<Object>} Result of the operation
   */
  deleteTemplate: async (templateId) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Note template not found');
      }
      
      if (template.isSystemTemplate) {
        throw new BadRequestError('Cannot delete system templates');
      }
      
      template.isActive = false;
      await template.save();
      
      logger.info(`Note template deleted (deactivated): ${templateId}`);
      return { success: true, message: 'Template deactivated successfully' };
    } catch (error) {
      logger.error('Error deleting note template', { 
        error: error.message, 
        templateId 
      });
      throw error;
    }
  },
  
  /**
   * Clone an existing template
   * @param {string} templateId - ID of the template to clone
   * @param {Object} modifications - Fields to modify in the cloned template
   * @returns {Promise<Object>} Cloned template
   */
  cloneTemplate: async (templateId, modifications = {}) => {
    try {
      const template = await NoteTemplate.findById(templateId);
      
      if (!template) {
        throw new NotFoundError('Note template not found');
      }
      
      // Create a copy without _id to generate a new document
      const templateData = template.toObject();
      delete templateData._id;
      delete templateData.createdAt;
      delete templateData.updatedAt;
      
      // Apply modifications
      const newTemplate = new NoteTemplate({
        ...templateData,
        isSystemTemplate: false, // Never clone as system template
        name: modifications.name || `Copy of ${templateData.name}`,
        ...modifications
      });
      
      await newTemplate.save();
      
      logger.info(`Note template cloned from ${templateId} to ${newTemplate._id}`);
      return newTemplate;
    } catch (error) {
      logger.error('Error cloning note template', { 
        error: error.message, 
        templateId 
      });
      throw error;
    }
  },
  
  /**
   * Create default system templates
   * @param {string} adminUserId - ID of admin user for ownership
   * @returns {Promise<Array>} Created templates
   */
  createDefaultTemplates: async (adminUserId) => {
    try {
      const soapTemplate = {
        name: 'Standard SOAP Note',
        description: 'Standard SOAP note template with subjective, objective, assessment, and plan sections',
        type: 'SOAP',
        isSystemTemplate: true,
        createdBy: adminUserId,
        fields: [
          {
            name: 'chiefComplaint',
            label: 'Chief Complaint',
            type: 'textarea',
            required: true,
            order: 1,
            section: 'subjective',
            hint: 'Patient\'s main reason for visit'
          },
          {
            name: 'historyOfPresentIllness',
            label: 'History of Present Illness',
            type: 'textarea',
            required: true,
            order: 2,
            section: 'subjective',
            hint: 'Detailed account of the development of the patient\'s illness'
          },
          {
            name: 'vitalSigns',
            label: 'Vital Signs',
            type: 'textarea',
            required: true,
            order: 1,
            section: 'objective',
            hint: 'Temperature, blood pressure, heart rate, respiratory rate, etc.'
          },
          {
            name: 'physicalExam',
            label: 'Physical Examination',
            type: 'textarea',
            required: true,
            order: 2,
            section: 'objective'
          },
          {
            name: 'assessment',
            label: 'Assessment',
            type: 'textarea',
            required: true,
            order: 1,
            section: 'assessment',
            hint: 'Diagnosis or clinical impression'
          },
          {
            name: 'plan',
            label: 'Plan',
            type: 'textarea',
            required: true,
            order: 1,
            section: 'plan',
            hint: 'Treatment plan, medications, follow-up, etc.'
          }
        ]
      };

      // Check if template already exists
      const existingTemplate = await NoteTemplate.findOne({ 
        name: soapTemplate.name, 
        isSystemTemplate: true 
      });

      if (existingTemplate) {
        logger.info('Default templates already exist, skipping creation');
        return [existingTemplate];
      }

      const createdTemplate = await noteTemplateService.createTemplate(soapTemplate);
      
      logger.info('Default note templates created');
      return [createdTemplate];
    } catch (error) {
      logger.error('Error creating default templates', { error: error.message });
      throw error;
    }
  }
};

module.exports = noteTemplateService;
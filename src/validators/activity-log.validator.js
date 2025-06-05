// File: src/validators/activity-log.validator.js
// New validator for activity log endpoints

const Joi = require('joi');

/**
 * Validation schemas for activity log related endpoints
 */
const activityLogValidator = {
  /**
   * Schema for activity log search parameters
   */
  searchLogsSchema: Joi.object({
    userId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    category: Joi.string().valid(
      'authentication',
      'data_access',
      'data_modification',
      'permission',
      'configuration',
      'user_management',
      'session_management',
      'api_access',
      'export',
      'system'
    ),
    action: Joi.string(),
    status: Joi.string().valid('success', 'failure', 'denied', 'error', 'warning', 'info'),
    resourceType: Joi.string(),
    resourceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    search: Joi.string().min(3).max(100),
    sortBy: Joi.string().valid('createdAt', 'category', 'action', 'status', 'username'),
    sortOrder: Joi.string().valid('asc', 'desc'),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100)
  }),

  /**
   * Schema for compliance report generation
   */
  complianceReportSchema: Joi.object({
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
    format: Joi.string().valid('json', 'csv', 'pdf').default('json')
  }),
  
  /**
   * Schema for manually creating a log entry (admin only)
   */
  createLogSchema: Joi.object({
    category: Joi.string().valid(
      'authentication',
      'data_access',
      'data_modification',
      'permission',
      'configuration',
      'user_management',
      'session_management',
      'api_access',
      'export',
      'system'
    ).required(),
    action: Joi.string().required(),
    status: Joi.string().valid('success', 'failure', 'denied', 'error', 'warning', 'info').required(),
    userId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    resourceType: Joi.string(),
    resourceId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    description: Joi.string().required(),
    details: Joi.object(),
    changes: Joi.object(),
    reason: Joi.string()
  })
};

module.exports = activityLogValidator;
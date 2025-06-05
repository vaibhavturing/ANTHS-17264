const Joi = require('joi');

/**
 * Validation schemas for session management endpoints
 */
const sessionValidator = {
  /**
   * Schema for updating session device name
   */
  updateSessionNameSchema: Joi.object({
    deviceName: Joi.string().trim().min(1).max(100).required()
      .messages({
        'string.empty': 'Device name cannot be empty',
        'string.min': 'Device name must be at least {#limit} character long',
        'string.max': 'Device name must be at most {#limit} characters long',
        'any.required': 'Device name is required'
      })
  }),

  /**
   * Schema for updating session preferences
   */
  updatePreferencesSchema: Joi.object({
    maxConcurrentSessions: Joi.number().integer().min(1).max(10)
      .messages({
        'number.base': 'Maximum concurrent sessions must be a number',
        'number.integer': 'Maximum concurrent sessions must be an integer',
        'number.min': 'Maximum concurrent sessions must be at least {#limit}',
        'number.max': 'Maximum concurrent sessions must be at most {#limit}'
      }),
      
    sessionStrategy: Joi.string().valid('oldest', 'least-active', 'notify', 'block')
      .messages({
        'string.base': 'Session strategy must be a string',
        'any.only': 'Session strategy must be one of: oldest, least-active, notify, block'
      })
  }).min(1) // At least one field must be provided
    .messages({
      'object.min': 'At least one preference must be provided'
    })
};

module.exports = sessionValidator;
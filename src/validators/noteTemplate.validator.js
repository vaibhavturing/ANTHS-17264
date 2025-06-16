const Joi = require('joi');
const { ObjectId } = require('mongoose').Types;

// Helper function to validate ObjectId
const isValidObjectId = (value, helpers) => {
  if (!ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Validation schema for form field
const formFieldSchema = Joi.object({
  name: Joi.string().required()
    .messages({
      'any.required': 'Field name is required',
      'string.empty': 'Field name cannot be empty'
    }),
  label: Joi.string().required()
    .messages({
      'any.required': 'Field label is required',
      'string.empty': 'Field label cannot be empty'
    }),
  fieldType: Joi.string().valid(
    'text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox', 'richtext'
  ).required()
    .messages({
      'any.required': 'Field type is required',
      'any.only': 'Field type must be one of the allowed types'
    }),
  required: Joi.boolean().default(false),
  placeholder: Joi.string().allow('', null),
  defaultValue: Joi.alternatives().try(
    Joi.string(),
    Joi.number(),
    Joi.boolean(),
    Joi.array()
  ),
  options: Joi.array().items(
    Joi.object({
      label: Joi.string().required(),
      value: Joi.string().required()
    })
  ).when('fieldType', {
    is: Joi.string().valid('select', 'radio', 'checkbox'),
    then: Joi.array().min(1).required()
      .messages({
        'array.min': 'Options are required for this field type',
        'any.required': 'Options are required for this field type'
      }),
    otherwise: Joi.optional()
  }),
  validation: Joi.object({
    minLength: Joi.number(),
    maxLength: Joi.number(),
    min: Joi.number(),
    max: Joi.number(),
    pattern: Joi.string(),
    customValidation: Joi.string()
  }),
  order: Joi.number().default(0),
  section: Joi.string().default('general'),
  helpText: Joi.string().allow('', null)
});

// Validation schema for section
const sectionSchema = Joi.object({
  name: Joi.string().required()
    .messages({
      'any.required': 'Section name is required',
      'string.empty': 'Section name cannot be empty'
    }),
  label: Joi.string().required()
    .messages({
      'any.required': 'Section label is required',
      'string.empty': 'Section label cannot be empty'
    }),
  order: Joi.number().default(0)
});

// Validation schemas for note templates
const noteTemplateValidator = {
  // Schema for creating a new template
  createTemplateSchema: Joi.object({
    name: Joi.string().required()
      .messages({
        'any.required': 'Template name is required',
        'string.empty': 'Template name cannot be empty'
      }),
    description: Joi.string().allow('', null),
    templateType: Joi.string().valid(
      'SOAP', 'Progress', 'Consultation', 'Discharge', 'Procedure', 'Physical', 'Mental', 'Custom'
    ).required()
      .messages({
        'any.required': 'Template type is required',
        'any.only': 'Template type must be one of the allowed types'
      }),
    specialty: Joi.string().allow('', null),
    isActive: Joi.boolean().default(true),
    isDefault: Joi.boolean().default(false),
    sections: Joi.array().items(sectionSchema).min(1)
      .messages({
        'array.min': 'At least one section is required'
      }),
    fields: Joi.array().items(formFieldSchema).min(1)
      .messages({
        'array.min': 'At least one field is required'
      }),
    autoPopulateFrom: Joi.array().items(
      Joi.object({
        sourceField: Joi.string().required(),
        targetField: Joi.string().required(),
        dataType: Joi.string().valid('patient', 'appointment', 'vitals', 'labResult').required()
      })
    )
  }),

  // Schema for updating a template
  updateTemplateSchema: Joi.object({
    name: Joi.string()
      .messages({
        'string.empty': 'Template name cannot be empty'
      }),
    description: Joi.string().allow('', null),
    templateType: Joi.string().valid(
      'SOAP', 'Progress', 'Consultation', 'Discharge', 'Procedure', 'Physical', 'Mental', 'Custom'
    )
      .messages({
        'any.only': 'Template type must be one of the allowed types'
      }),
    specialty: Joi.string().allow('', null),
    isActive: Joi.boolean(),
    isDefault: Joi.boolean(),
    sections: Joi.array().items(sectionSchema)
      .messages({
        'array.min': 'At least one section is required'
      }),
    fields: Joi.array().items(formFieldSchema)
      .messages({
        'array.min': 'At least one field is required'
      }),
    autoPopulateFrom: Joi.array().items(
      Joi.object({
        sourceField: Joi.string().required(),
        targetField: Joi.string().required(),
        dataType: Joi.string().valid('patient', 'appointment', 'vitals', 'labResult').required()
      })
    )
  }),

  // Schema for cloning a template
  cloneTemplateSchema: Joi.object({
    name: Joi.string()
      .messages({
        'string.empty': 'Template name cannot be empty'
      })
  })
};

module.exports = noteTemplateValidator;
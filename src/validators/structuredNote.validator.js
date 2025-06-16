const Joi = require('joi');
const { ObjectId } = require('mongoose').Types;

// Helper function to validate ObjectId
const isValidObjectId = (value, helpers) => {
  if (!ObjectId.isValid(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Validation schemas for structured notes
const structuredNoteValidator = {
  // Schema for creating a new note
  createNoteSchema: Joi.object({
    patient: Joi.string().custom(isValidObjectId).required()
      .messages({
        'any.required': 'Patient ID is required',
        'any.invalid': 'Invalid patient ID format'
      }),
    appointment: Joi.string().custom(isValidObjectId)
      .messages({
        'any.invalid': 'Invalid appointment ID format'
      }),
    provider: Joi.string().custom(isValidObjectId)
      .messages({
        'any.invalid': 'Invalid provider ID format'
      }),
    template: Joi.string().custom(isValidObjectId).required()
      .messages({
        'any.required': 'Template ID is required',
        'any.invalid': 'Invalid template ID format'
      }),
    title: Joi.string().required()
      .messages({
        'any.required': 'Note title is required',
        'string.empty': 'Note title cannot be empty'
      }),
    noteDate: Joi.date().default(Date.now),
    content: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
    ),
    status: Joi.string().valid('draft', 'completed', 'signed', 'amended').default('draft'),
    components: Joi.object({
      chiefComplaint: Joi.string(),
      subjectiveData: Joi.string(),
      objectiveData: Joi.string(),
      assessment: Joi.string(),
      plan: Joi.string()
    }),
    diagnoses: Joi.array().items(
      Joi.object({
        code: Joi.string(),
        description: Joi.string().required(),
        type: Joi.string().valid('primary', 'secondary').default('primary')
      })
    ),
    prescriptions: Joi.array().items(
      Joi.string().custom(isValidObjectId)
        .messages({
          'any.invalid': 'Invalid prescription ID format'
        })
    ),
    labOrders: Joi.array().items(
      Joi.string().custom(isValidObjectId)
        .messages({
          'any.invalid': 'Invalid lab order ID format'
        })
    ),
    relatedNotes: Joi.array().items(
      Joi.string().custom(isValidObjectId)
        .messages({
          'any.invalid': 'Invalid note ID format'
        })
    )
  }),

  // Schema for updating a note
  updateNoteSchema: Joi.object({
    title: Joi.string()
      .messages({
        'string.empty': 'Note title cannot be empty'
      }),
    noteDate: Joi.date(),
    content: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
    ),
    status: Joi.string().valid('draft', 'completed'),
    components: Joi.object({
      chiefComplaint: Joi.string(),
      subjectiveData: Joi.string(),
      objectiveData: Joi.string(),
      assessment: Joi.string(),
      plan: Joi.string()
    }),
    diagnoses: Joi.array().items(
      Joi.object({
        code: Joi.string(),
        description: Joi.string().required(),
        type: Joi.string().valid('primary', 'secondary').default('primary')
      })
    ),
    prescriptions: Joi.array().items(
      Joi.string().custom(isValidObjectId)
        .messages({
          'any.invalid': 'Invalid prescription ID format'
        })
    ),
    labOrders: Joi.array().items(
      Joi.string().custom(isValidObjectId)
        .messages({
          'any.invalid': 'Invalid lab order ID format'
        })
    ),
    relatedNotes: Joi.array().items(
      Joi.string().custom(isValidObjectId)
        .messages({
          'any.invalid': 'Invalid note ID format'
        })
    )
  }),

  // Schema for amending a note
  amendNoteSchema: Joi.object({
    reason: Joi.string().required()
      .messages({
        'any.required': 'Amendment reason is required',
        'string.empty': 'Amendment reason cannot be empty'
      }),
    content: Joi.object().pattern(
      Joi.string(),
      Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean(), Joi.array())
    ).required()
      .messages({
        'any.required': 'Updated content is required'
      })
  })
};

module.exports = structuredNoteValidator;
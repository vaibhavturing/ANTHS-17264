const Joi = require('joi');

const fieldSchema = Joi.object({
  name: Joi.string().required(),
  label: Joi.string().required(),
  type: Joi.string().valid(
    'text', 'textarea', 'number', 'select', 'checkbox', 'radio', 'date'
  ).required(),
  required: Joi.boolean(),
  options: Joi.when('type', {
    is: Joi.string().valid('select', 'checkbox', 'radio'),
    then: Joi.array().items(
      Joi.object({
        label: Joi.string().required(),
        value: Joi.string().required()
      })
    ).min(1).required(),
    otherwise: Joi.array().items(
      Joi.object({
        label: Joi.string().required(),
        value: Joi.string().required()
      })
    )
  }),
  defaultValue: Joi.any(),
  order: Joi.number().integer(),
  section: Joi.string().valid('subjective', 'objective', 'assessment', 'plan', 'other'),
  hint: Joi.string()
});

const templateSchemas = {
  create: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    type: Joi.string().valid(
      'SOAP', 'Progress', 'Consultation', 'Discharge', 'Admission', 'Surgical', 'Custom'
    ).required(),
    fields: Joi.array().items(fieldSchema).min(1).required(),
    isSystemTemplate: Joi.boolean(),
    createdBy: Joi.string().required(),
    specialtyRelevance: Joi.array().items(Joi.string())
  }),
  
  update: Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    fields: Joi.array().items(fieldSchema).min(1),
    isActive: Joi.boolean(),
    adminOverride: Joi.boolean(),
    specialtyRelevance: Joi.array().items(Joi.string())
  }),
  
  getAll: Joi.object({
    type: Joi.string().valid(
      'SOAP', 'Progress', 'Consultation', 'Discharge', 'Admission', 'Surgical', 'Custom'
    ),
    specialtyRelevance: Joi.string(),
    createdBy: Joi.string()
  })
};

const clinicalNoteSchemas = {
  create: Joi.object({
    patient: Joi.string().required(),
    doctor: Joi.string().required(),
    templateId: Joi.string().required(),
    fieldData: Joi.array().items(
      Joi.object({
        fieldId: Joi.string().required(),
        name: Joi.string().required(),
        value: Joi.any().required()
      })
    ).min(1).required(),
    visitDate: Joi.date().iso(),
    relatedAppointment: Joi.string(),
    tags: Joi.array().items(Joi.string()),
    status: Joi.string().valid('draft', 'completed', 'signed')
  }),
  
  update: Joi.object({
    fieldData: Joi.array().items(
      Joi.object({
        fieldId: Joi.string().required(),
        name: Joi.string().required(),
        value: Joi.any().required()
      })
    ),
    visitDate: Joi.date().iso(),
    relatedAppointment: Joi.string(),
    tags: Joi.array().items(Joi.string()),
    status: Joi.string().valid('draft', 'completed', 'signed'),
    allowEditSigned: Joi.boolean()
  }),
  
  getPatientNotes: Joi.object({
    status: Joi.string().valid('draft', 'completed', 'signed'),
    templateType: Joi.string().valid(
      'SOAP', 'Progress', 'Consultation', 'Discharge', 'Admission', 'Surgical', 'Custom'
    ),
    doctor: Joi.string(),
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
    sort: Joi.object(),
    populate: Joi.boolean()
  }),
  
  search: Joi.object({
    patient: Joi.string(),
    doctor: Joi.string(),
    templateType: Joi.string().valid(
      'SOAP', 'Progress', 'Consultation', 'Discharge', 'Admission', 'Surgical', 'Custom'
    ),
    status: Joi.string().valid('draft', 'completed', 'signed'),
    tags: Joi.array().items(Joi.string()),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso(),
    textSearch: Joi.string(),
    limit: Joi.number().integer().min(1).max(100),
    page: Joi.number().integer().min(1),
    sort: Joi.object(),
    populate: Joi.boolean()
  })
};

module.exports = {
  templateSchemas,
  clinicalNoteSchemas
};
const Joi = require('joi');
const { objectId } = require('./custom.validator');

const uploadFile = {
  body: Joi.object().keys({
    patientId: Joi.string().custom(objectId).required(),
    imageType: Joi.string().valid('x-ray', 'mri', 'ct-scan', 'ultrasound', 'mammogram', 'dexa', 'pet', 'other', null),
    documentType: Joi.string().valid('lab-report', 'clinical-note', 'referral', 'consent-form', 'discharge-summary', 'pathology-report', 'other', null),
    bodyPart: Joi.string(),
    description: Joi.string().max(500),
    accessLevel: Joi.string().valid('public', 'restricted', 'confidential').default('restricted'),
    visitId: Joi.string().custom(objectId),
    orderId: Joi.string().custom(objectId),
    tags: Joi.string() // Comma-separated list of tags
  })
};

const updateFileMetadata = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required()
  }),
  body: Joi.object().keys({
    description: Joi.string().max(500),
    tags: Joi.alternatives().try(
      Joi.string(), // Comma-separated string
      Joi.array().items(Joi.string()) // Array of strings
    ),
    accessLevel: Joi.string().valid('public', 'restricted', 'confidential'),
    imageType: Joi.string().valid('x-ray', 'mri', 'ct-scan', 'ultrasound', 'mammogram', 'dexa', 'pet', 'other', null),
    documentType: Joi.string().valid('lab-report', 'clinical-note', 'referral', 'consent-form', 'discharge-summary', 'pathology-report', 'other', null),
    bodyPart: Joi.string()
  }).min(1) // At least one field must be provided
};

module.exports = {
  uploadFile,
  updateFileMetadata
};
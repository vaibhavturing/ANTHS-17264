// src/validators/medicalRecord.validator.js

const { Joi, objectId } = require('./common.validator');

// Example medical record schema validation (adapt based on your actual structure)
const createMedicalRecordSchema = {
  body: Joi.object({
    patient: objectId.required(),
    doctor: objectId.optional(),
    diagnosis: Joi.string().max(1000).required(),
    notes: Joi.string().max(5000).optional(),
    visitDate: Joi.date().required(),
    medications: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        dosage: Joi.string().required(),
        frequency: Joi.string().required(),
        duration: Joi.string().required(),
        instructions: Joi.string().optional()
      })
    ).optional(),
    labResults: Joi.array().items(
      Joi.object({
        testName: Joi.string().required(),
        result: Joi.string().required(),
        date: Joi.date().required(),
        notes: Joi.string().optional()
      })
    ).optional(),
    imaging: Joi.array().items(
      Joi.object({
        type: Joi.string().required(),
        imageUrl: Joi.string().uri().required(),
        date: Joi.date().required(),
        report: Joi.string().optional()
      })
    ).optional(),
    allergies: Joi.array().items(
      Joi.object({
        substance: Joi.string().required(),
        reaction: Joi.string().required(),
        severity: Joi.string().valid('mild', 'moderate', 'severe').required()
      })
    ).optional()
  })
};

const updateMedicalRecordSchema = {
  params: Joi.object({
    recordId: objectId.required()
  }),
  body: Joi.object({
    doctor: objectId.optional(),
    diagnosis: Joi.string().max(1000).optional(),
    notes: Joi.string().max(5000).optional(),
    visitDate: Joi.date().optional(),
    medications: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        dosage: Joi.string().required(),
        frequency: Joi.string().required(),
        duration: Joi.string().required(),
        instructions: Joi.string().optional()
      })
    ).optional(),
    labResults: Joi.array().items(
      Joi.object({
        testName: Joi.string().required(),
        result: Joi.string().required(),
        date: Joi.date().required(),
        notes: Joi.string().optional()
      })
    ).optional(),
    imaging: Joi.array().items(
      Joi.object({
        type: Joi.string().required(),
        imageUrl: Joi.string().uri().required(),
        date: Joi.date().required(),
        report: Joi.string().optional()
      })
    ).optional(),
    allergies: Joi.array().items(
      Joi.object({
        substance: Joi.string().required(),
        reaction: Joi.string().required(),
        severity: Joi.string().valid('mild', 'moderate', 'severe').required()
      })
    ).optional()
  }).min(1).message('At least one field must be provided for update')
};

const getMedicalRecordByIdSchema = {
  params: Joi.object({
    recordId: objectId.required()
  })
};

const deleteMedicalRecordSchema = {
  params: Joi.object({
    recordId: objectId.required()
  })
};

module.exports = {
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  getMedicalRecordByIdSchema,
  deleteMedicalRecordSchema
};

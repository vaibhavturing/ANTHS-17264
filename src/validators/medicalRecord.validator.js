// src/validators/medicalRecord.validator.js

const Joi = require('joi');
const { RECORD_CATEGORIES } = require('../models/medicalRecord.model');

// Validation schema for file attachments
const fileAttachmentSchema = Joi.object({
  originalName: Joi.string().required(),
  mimeType: Joi.string().required(),
  size: Joi.number().required().max(10 * 1024 * 1024), // 10MB max file size
});

// Base schema for creating a medical record
const createMedicalRecordSchema = Joi.object({
  patient: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    .messages({
      'string.pattern.base': 'Patient ID must be a valid ObjectId',
      'any.required': 'Patient ID is required'
    }),
  
  category: Joi.string().valid(...Object.values(RECORD_CATEGORIES)).required()
    .messages({
      'any.only': 'Category must be one of the valid medical record categories',
      'any.required': 'Category is required'
    }),
  
  title: Joi.string().min(3).max(200).required()
    .messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least {#limit} characters',
      'string.max': 'Title cannot exceed {#limit} characters'
    }),
  
  description: Joi.string().max(2000).allow('', null),
  
  recordDate: Joi.date().max('now').required()
    .messages({
      'date.base': 'Record date must be a valid date',
      'date.max': 'Record date cannot be in the future',
      'any.required': 'Record date is required'
    }),
  
  provider: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    .messages({
      'string.pattern.base': 'Provider ID must be a valid ObjectId',
      'any.required': 'Provider ID is required'
    }),
  
  facility: Joi.string().max(200).allow('', null),
  
  isConfidential: Joi.boolean().default(false),
  
  content: Joi.object().default({}),
  
  tags: Joi.array().items(Joi.string().max(50)).default([]),
  
  externalReferences: Joi.array().items(
    Joi.object({
      system: Joi.string().required(),
      identifier: Joi.string().required(),
      url: Joi.string().uri().allow('', null)
    })
  ).default([])
});

// Schema for updating a medical record
const updateMedicalRecordSchema = Joi.object({
  category: Joi.string().valid(...Object.values(RECORD_CATEGORIES)),
  
  title: Joi.string().min(3).max(200)
    .messages({
      'string.min': 'Title must be at least {#limit} characters',
      'string.max': 'Title cannot exceed {#limit} characters'
    }),
  
  description: Joi.string().max(2000).allow('', null),
  
  recordDate: Joi.date().max('now')
    .messages({
      'date.base': 'Record date must be a valid date',
      'date.max': 'Record date cannot be in the future'
    }),
  
  facility: Joi.string().max(200).allow('', null),
  
  isConfidential: Joi.boolean(),
  
  content: Joi.object(),
  
  tags: Joi.array().items(Joi.string().max(50)),
  
  isFlagged: Joi.boolean(),
  
  flagReason: Joi.string().max(200).allow('', null),
  
  externalReferences: Joi.array().items(
    Joi.object({
      system: Joi.string().required(),
      identifier: Joi.string().required(),
      url: Joi.string().uri().allow('', null)
    })
  )
});

// Schema for granting access to a medical record
const accessControlSchema = Joi.object({
  userId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    .messages({
      'string.pattern.base': 'User ID must be a valid ObjectId',
      'any.required': 'User ID is required'
    }),
  
  accessLevel: Joi.string().valid('read', 'write', 'admin').required()
    .messages({
      'any.only': 'Access level must be one of: read, write, admin',
      'any.required': 'Access level is required'
    }),
  
  reason: Joi.string().max(500).allow('', null),
  
  expiresAt: Joi.date().min('now').allow(null)
    .messages({
      'date.base': 'Expiration date must be a valid date',
      'date.min': 'Expiration date must be in the future'
    })
});

// Schema for medical record search queries
const searchMedicalRecordsSchema = Joi.object({
  patientId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
  
  categories: Joi.array().items(
    Joi.string().valid(...Object.values(RECORD_CATEGORIES))
  ),
  
  startDate: Joi.date(),
  
  endDate: Joi.date().when('startDate', {
    is: Joi.exist(),
    then: Joi.date().min(Joi.ref('startDate')),
    otherwise: Joi.date()
  }),
  
  searchTerm: Joi.string().min(2).max(100),
  
  tags: Joi.array().items(Joi.string()),
  
  provider: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
  
  page: Joi.number().integer().min(1).default(1),
  
  limit: Joi.number().integer().min(1).max(100).default(20),
  
  sortBy: Joi.string().valid('recordDate', 'createdAt', 'title').default('recordDate'),
  
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  
  includeDeleted: Joi.boolean().default(false)
});

module.exports = {
  createMedicalRecordSchema,
  updateMedicalRecordSchema,
  accessControlSchema,
  searchMedicalRecordsSchema,
  fileAttachmentSchema
};
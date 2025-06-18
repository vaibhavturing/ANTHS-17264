// src/validators/search.validator.js

const { query } = require('express-validator');

const searchRecordsValidator = [
  query('query').optional().isString().trim(),
  query('diagnosis').optional().isString().trim(),
  query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid date'),
  query('toDate').optional().isISO8601().withMessage('toDate must be a valid date'),
  query('doctorId').optional().isMongoId().withMessage('doctorId must be a valid ID'),
  query('contentType').optional().isIn(['notes', 'prescriptions', 'all']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

const searchPatientsValidator = [
  query('query').optional().isString().trim(),
  query('diagnosis').optional().isString().trim(),
  query('year').optional().isInt().toInt(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

module.exports = {
  searchRecordsValidator,
  searchPatientsValidator
};
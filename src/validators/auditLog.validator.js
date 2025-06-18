// src/validators/auditLog.validator.js

const { query, param } = require('express-validator');

const getLogsValidator = [
  query('entityType').optional().isString().trim(),
  query('entityId').optional().isMongoId().withMessage('Entity ID must be a valid ID'),
  query('patientId').optional().isMongoId().withMessage('Patient ID must be a valid ID'),
  query('userId').optional().isMongoId().withMessage('User ID must be a valid ID'),
  query('userRole').optional().isString().trim(),
  query('action').optional().isIn(['view', 'create', 'update', 'delete']),
  query('successful').optional().isIn(['true', 'false']),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
];

const patientAccessReportValidator = [
  param('patientId').isMongoId().withMessage('Patient ID must be a valid ID'),
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date')
];

const systemAccessReportValidator = [
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('groupBy').optional().isIn(['hour', 'day', 'week', 'month']).withMessage('Group by must be one of: hour, day, week, month')
];

module.exports = {
  getLogsValidator,
  patientAccessReportValidator,
  systemAccessReportValidator
};
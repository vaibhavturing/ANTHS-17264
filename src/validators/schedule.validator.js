// File: src/validators/schedule.validator.js
const { body, param, query } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Validators for schedule-related operations
 */
const scheduleValidator = {
  // Validator for creating a recurring schedule template
  createTemplate: [
    body('name')
      .notEmpty().withMessage('Template name is required')
      .isString().withMessage('Template name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Template name must be between 2 and 100 characters'),
    
    body('doctor')
      .optional()
      .isMongoId().withMessage('Invalid doctor ID format')
      .custom(value => mongoose.Types.ObjectId.isValid(value))
      .withMessage('Invalid doctor ID'),
    
    body('weeklySchedule')
      .isArray().withMessage('Weekly schedule must be an array')
      .notEmpty().withMessage('Weekly schedule cannot be empty'),
    
    body('weeklySchedule.*.dayOfWeek')
      .isInt({ min: 0, max: 6 }).withMessage('Day of week must be between 0 and 6 (0 = Sunday)'),
    
    body('weeklySchedule.*.workingHours')
      .isArray().withMessage('Working hours must be an array'),
    
    body('weeklySchedule.*.workingHours.*.startTime')
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage('Start time must be in 24-hour format (HH:MM)'),
    
    body('weeklySchedule.*.workingHours.*.endTime')
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage('End time must be in 24-hour format (HH:MM)')
      .custom((value, { req, path }) => {
        const pathParts = path.split('.');
        pathParts.pop();
        const startPath = [...pathParts, 'startTime'].join('.');
        const startTime = req.body.get(startPath);
        
        if (startTime >= value) {
          throw new Error('End time must be after start time');
        }
        return true;
      }),
    
    body('weeklySchedule.*.breaks')
      .optional()
      .isArray().withMessage('Breaks must be an array'),
    
    body('weeklySchedule.*.breaks.*.startTime')
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage('Break start time must be in 24-hour format (HH:MM)'),
    
    body('weeklySchedule.*.breaks.*.endTime')
      .optional()
      .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
      .withMessage('Break end time must be in 24-hour format (HH:MM)'),
    
    body('effectiveFrom')
      .optional()
      .isISO8601().withMessage('Effective from date must be a valid ISO 8601 date'),
    
    body('effectiveUntil')
      .optional()
      .isISO8601().withMessage('Effective until date must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (req.body.effectiveFrom && new Date(value) <= new Date(req.body.effectiveFrom)) {
          throw new Error('Effective until date must be after effective from date');
        }
        return true;
      }),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    
    body('priority')
      .optional()
      .isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10')
  ],
  
  // Validator for updating a recurring schedule template
  updateTemplate: [
    param('templateId')
      .isMongoId().withMessage('Invalid template ID format'),
    
    body('name')
      .optional()
      .isString().withMessage('Template name must be a string')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Template name must be between 2 and 100 characters'),
    
    body('weeklySchedule')
      .optional()
      .isArray().withMessage('Weekly schedule must be an array'),
    
    body('weeklySchedule.*.dayOfWeek')
      .optional()
      .isInt({ min: 0, max: 6 }).withMessage('Day of week must be between 0 and 6 (0 = Sunday)'),
    
    body('effectiveFrom')
      .optional()
      .isISO8601().withMessage('Effective from date must be a valid ISO 8601 date'),
    
    body('effectiveUntil')
      .optional()
      .isISO8601().withMessage('Effective until date must be a valid ISO 8601 date'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    
    body('priority')
      .optional()
      .isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10')
  ],
  
  // Validator for generating schedules
  generateSchedules: [
    param('doctorId')
      .isMongoId().withMessage('Invalid doctor ID format'),
    
    body('startDate')
      .isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    
    body('endDate')
      .isISO8601().withMessage('End date must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      })
  ],
  
  // Validator for updating a doctor's schedule
  updateSchedule: [
    param('scheduleId')
      .isMongoId().withMessage('Invalid schedule ID format'),
    
    body('isWorkingDay')
      .optional()
      .isBoolean().withMessage('isWorkingDay must be a boolean'),
    
    body('notes')
      .optional()
      .isString().withMessage('Notes must be a string')
      .trim(),
    
    body('status')
      .optional()
      .isIn(['draft', 'published', 'modified']).withMessage('Status must be draft, published, or modified'),
    
    body('timeSlots')
      .optional()
      .isArray().withMessage('Time slots must be an array'),
    
    body('timeSlots.*.startTime')
      .optional()
      .isISO8601().withMessage('Start time must be a valid ISO 8601 date'),
    
    body('timeSlots.*.endTime')
      .optional()
      .isISO8601().withMessage('End time must be a valid ISO 8601 date')
      .custom((value, { req, path }) => {
        const index = path.split('.')[1];
        const startTime = req.body.timeSlots[index].startTime;
        
        if (new Date(startTime) >= new Date(value)) {
          throw new Error('End time must be after start time');
        }
        return true;
      }),
    
    body('timeSlots.*.status')
      .optional()
      .isIn(['available', 'booked', 'blocked', 'leave', 'break'])
      .withMessage('Time slot status must be one of: available, booked, blocked, leave, break'),
    
    body('addTimeSlots')
      .optional()
      .isArray().withMessage('Add time slots must be an array'),
    
    body('updateTimeSlots')
      .optional()
      .isArray().withMessage('Update time slots must be an array'),
    
    body('updateTimeSlots.*._id')
      .optional()
      .isMongoId().withMessage('Invalid time slot ID format'),
    
    body('removeTimeSlots')
      .optional()
      .isArray().withMessage('Remove time slots must be an array of time slot IDs')
  ],
  
  // Validator for checking schedule conflicts
  checkConflicts: [
    body('doctorId')
      .isMongoId().withMessage('Invalid doctor ID format'),
    
    body('startTime')
      .isISO8601().withMessage('Start time must be a valid ISO 8601 date'),
    
    body('endTime')
      .isISO8601().withMessage('End time must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startTime)) {
          throw new Error('End time must be after start time');
        }
        return true;
      })
  ]
};

module.exports = { scheduleValidator };
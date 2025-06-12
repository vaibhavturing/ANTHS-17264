// File: src/validators/availability.validator.js
const { body, param, query } = require('express-validator');

/**
 * Validators for availability-related operations
 */
const availabilityValidator = {
  // Validator for creating availability configuration
  createAvailability: [
    body('doctor')
      .optional()
      .isMongoId().withMessage('Invalid doctor ID format'),
    
    body('effectiveFrom')
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
      .isIn(['active', 'inactive', 'pending']).withMessage('Status must be active, inactive, or pending'),
    
    body('recurringSchedule')
      .optional()
      .isMongoId().withMessage('Invalid recurring schedule template ID'),
    
    body('maxAppointmentsPerDay')
      .optional()
      .isInt({ min: 1 }).withMessage('Maximum appointments per day must be a positive integer'),
    
    body('availableAppointmentTypes')
      .optional()
      .isArray().withMessage('Available appointment types must be an array')
      .custom(value => value.every(id => /^[0-9a-fA-F]{24}$/.test(id)))
      .withMessage('Invalid appointment type ID format'),
    
    body('availableLocations')
      .optional()
      .isArray().withMessage('Available locations must be an array')
      .custom(value => value.every(id => /^[0-9a-fA-F]{24}$/.test(id)))
      .withMessage('Invalid location ID format'),
    
    body('defaultBufferTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Default buffer time must be a non-negative integer'),
    
    body('minimumNoticeTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Minimum notice time must be a non-negative integer'),
    
    body('maximumBookingWindow')
      .optional()
      .isInt({ min: 1 }).withMessage('Maximum booking window must be a positive integer')
  ],
  
  // Validator for updating availability configuration
  updateAvailability: [
    param('availabilityId')
      .isMongoId().withMessage('Invalid availability ID format'),
    
    body('effectiveFrom')
      .optional()
      .isISO8601().withMessage('Effective from date must be a valid ISO 8601 date'),
    
    body('effectiveUntil')
      .optional()
      .isISO8601().withMessage('Effective until date must be a valid ISO 8601 date'),
    
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'pending']).withMessage('Status must be active, inactive, or pending'),
    
    body('recurringSchedule')
      .optional()
      .isMongoId().withMessage('Invalid recurring schedule template ID'),
    
    body('maxAppointmentsPerDay')
      .optional()
      .isInt({ min: 1 }).withMessage('Maximum appointments per day must be a positive integer'),
    
    body('availableAppointmentTypes')
      .optional()
      .isArray().withMessage('Available appointment types must be an array'),
    
    body('defaultBufferTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Default buffer time must be a non-negative integer'),
    
    body('minimumNoticeTime')
      .optional()
      .isInt({ min: 0 }).withMessage('Minimum notice time must be a non-negative integer'),
    
    body('maximumBookingWindow')
      .optional()
      .isInt({ min: 1 }).withMessage('Maximum booking window must be a positive integer')
  ],
  
  // Validator for creating leave request
  createLeaveRequest: [
    body('doctor')
      .optional()
      .isMongoId().withMessage('Invalid doctor ID format'),
    
    body('leaveType')
      .isIn(['vacation', 'sick', 'conference', 'training', 'personal', 'other'])
      .withMessage('Leave type must be one of: vacation, sick, conference, training, personal, other'),
    
    body('startDateTime')
      .isISO8601().withMessage('Start date and time must be a valid ISO 8601 date'),
    
    body('endDateTime')
      .isISO8601().withMessage('End date and time must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startDateTime)) {
          throw new Error('End date and time must be after start date and time');
        }
        return true;
      }),
    
    body('isAllDay')
      .optional()
      .isBoolean().withMessage('isAllDay must be a boolean'),
    
    body('description')
      .notEmpty().withMessage('Description is required')
      .isString().withMessage('Description must be a string')
      .trim(),
    
    body('emergencyContact')
      .optional()
      .isObject().withMessage('Emergency contact must be an object'),
    
    body('emergencyContact.name')
      .optional()
      .isString().withMessage('Emergency contact name must be a string'),
    
    body('emergencyContact.phone')
      .optional()
      .isString().withMessage('Emergency contact phone must be a string'),
    
    body('emergencyContact.email')
      .optional()
      .isEmail().withMessage('Emergency contact email must be a valid email'),
    
    body('coverageArrangements')
      .optional()
      .isObject().withMessage('Coverage arrangements must be an object'),
    
    body('coverageArrangements.coveredBy')
      .optional()
      .isMongoId().withMessage('Invalid doctor ID for coverage')
  ],
  
  // Validator for updating leave status
  updateLeaveStatus: [
    param('leaveId')
      .isMongoId().withMessage('Invalid leave ID format'),
    
    body('status')
      .isIn(['pending', 'approved', 'rejected', 'cancelled'])
      .withMessage('Status must be one of: pending, approved, rejected, cancelled'),
    
    body('notes')
      .optional()
      .isString().withMessage('Notes must be a string')
      .trim()
  ],
  
  // Validator for scheduling a break
  scheduleBreak: [
    body('doctor')
      .optional()
      .isMongoId().withMessage('Invalid doctor ID format'),
    
    body('date')
      .isISO8601().withMessage('Date must be a valid ISO 8601 date'),
    
    body('startTime')
      .isISO8601().withMessage('Start time must be a valid ISO 8601 date'),
    
    body('endTime')
      .isISO8601().withMessage('End time must be a valid ISO 8601 date')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.startTime)) {
          throw new Error('End time must be after start time');
        }
        return true;
      }),
    
    body('reason')
      .notEmpty().withMessage('Reason is required')
      .isString().withMessage('Reason must be a string')
      .trim(),
    
    body('isRecurring')
      .optional()
      .isBoolean().withMessage('isRecurring must be a boolean'),
    
    body('recurrenceRule')
      .optional()
      .isString().withMessage('Recurrence rule must be a string')
  ],
  
  // Validator for updating a break
  updateBreak: [
    param('breakId')
      .isMongoId().withMessage('Invalid break ID format'),
    
    body('startTime')
      .optional()
      .isISO8601().withMessage('Start time must be a valid ISO 8601 date'),
    
    body('endTime')
      .optional()
      .isISO8601().withMessage('End time must be a valid ISO 8601 date'),
    
    body('reason')
      .optional()
      .isString().withMessage('Reason must be a string')
      .trim(),
    
    body('status')
      .optional()
      .isIn(['scheduled', 'cancelled']).withMessage('Status must be scheduled or cancelled'),
    
    body('notes')
      .optional()
      .isString().withMessage('Notes must be a string')
      .trim()
  ],
  
  // Validator for checking availability
  checkAvailability: [
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

module.exports = { availabilityValidator };
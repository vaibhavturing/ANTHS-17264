const Joi = require('joi');

/**
 * Validators for patient search functionality
 */
const patientSearchValidators = {
  // Validate search parameters
  advancedSearch: Joi.object({
    name: Joi.string().trim().max(100),
    mrn: Joi.string().trim().max(50),
    ssn: Joi.string().trim().pattern(/^(?:\d{3}-?\d{2}-?\d{4}|\d{9})$/),
    phone: Joi.string().trim().max(20),
    dob: Joi.date().iso(),
    ageFrom: Joi.number().integer().min(0).max(120),
    ageTo: Joi.number().integer().min(0).max(120),
    gender: Joi.string().valid('Male', 'Female', 'Other', 'Prefer not to say'),
    status: Joi.string().valid('Incomplete', 'Pending', 'Approved', 'Rejected'),
    regDateFrom: Joi.date().iso(),
    regDateTo: Joi.date().iso().min(Joi.ref('regDateFrom')),
    insurance: Joi.string().trim().max(100),
    bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'),
    condition: Joi.string().trim().max(100),
    doctor: Joi.string().trim().max(100),
    recentActivity: Joi.number().integer().min(1).max(365),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    sortField: Joi.string().valid(
      'registrationDate', 'dateOfBirth', 'lastName', 'profileCompleteness', 'relevance'
    ),
    sortOrder: Joi.string().valid('asc', 'desc')
  }),
  
  // Validate export parameters
  exportSearch: Joi.object({
    name: Joi.string().trim().max(100),
    mrn: Joi.string().trim().max(50),
    ssn: Joi.string().trim().pattern(/^(?:\d{3}-?\d{2}-?\d{4}|\d{9})$/),
    phone: Joi.string().trim().max(20),
    dob: Joi.date().iso(),
    ageFrom: Joi.number().integer().min(0).max(120),
    ageTo: Joi.number().integer().min(0).max(120),
    gender: Joi.string().valid('Male', 'Female', 'Other', 'Prefer not to say'),
    status: Joi.string().valid('Incomplete', 'Pending', 'Approved', 'Rejected'),
    regDateFrom: Joi.date().iso(),
    regDateTo: Joi.date().iso().min(Joi.ref('regDateFrom')),
    insurance: Joi.string().trim().max(100),
    bloodType: Joi.string().valid('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'),
    condition: Joi.string().trim().max(100),
    doctor: Joi.string().trim().max(100),
    recentActivity: Joi.number().integer().min(1).max(365),
    format: Joi.string().valid('csv', 'excel', 'pdf').required()
  }),
  
  // Validate save search request
  saveSearch: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    searchParams: Joi.object().required()
  })
};

module.exports = patientSearchValidators;
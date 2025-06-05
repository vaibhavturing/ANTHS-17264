const express = require('express');
const patientSearchController = require('../controllers/patient-search.controller');
const authMiddleware = require('../middleware/auth.middleware');
const validator = require('../middleware/validator.middleware');
const patientSearchValidators = require('../validators/patient-search.validator');
const rbacMiddleware = require('../middleware/rbac.middleware');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

/**
 * Advanced patient search routes
 */

// Advanced search with filters
router.get(
  '/advanced',
  validator(patientSearchValidators.advancedSearch, 'query'),
  patientSearchController.advancedSearch
);

// Export search results
router.get(
  '/export',
  rbacMiddleware.check({ 
    resource: 'patients.export', 
    action: 'create',
    requiredRoles: ['admin', 'doctor']
  }),
  validator(patientSearchValidators.exportSearch, 'query'),
  patientSearchController.exportSearchResults
);

// Save search for later use
router.post(
  '/save',
  validator(patientSearchValidators.saveSearch),
  patientSearchController.saveSearch
);

// Get saved searches
router.get(
  '/saved',
  patientSearchController.getSavedSearches
);

// Get search history
router.get(
  '/history',
  patientSearchController.getSearchHistory
);

module.exports = router;
const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/search.controller');
const { searchRecordsValidator, searchPatientsValidator } = require('../validators/search.validator');
const { protect } = require('../middleware/auth.middleware'); // <-- Use destructuring to get the middleware function
const roleMiddleware = require('../middleware/role.middleware');

// Apply authentication middleware to all routes
router.use(protect);

// Search for records (requires authenticated user)
router.get('/records', 
  searchRecordsValidator,
  SearchController.searchRecords
);

// Search for patients (requires doctor or admin role)
router.get('/patients',
  searchPatientsValidator,
  roleMiddleware(['doctor', 'admin', 'nurse']),
  SearchController.searchPatients
);

module.exports = router;
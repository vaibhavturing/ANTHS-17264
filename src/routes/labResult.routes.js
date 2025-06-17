const express = require('express');
const router = express.Router();
const labResultController = require('../controllers/labResult.controller');
const authMiddleware = require('../middleware/auth.middleware');
const authorizationMiddleware = require('../middleware/authorization.middleware');

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Get available lab connections
router.get('/connections',
  authorizationMiddleware.checkRole(['admin', 'doctor']),
  labResultController.getLabConnections
);

// Import results from a lab system
router.post('/import/:patientId/:labName',
  authorizationMiddleware.checkRole(['admin', 'doctor']),
  labResultController.importLabResults
);

// Manually add lab result
router.post('/manual/:patientId',
  authorizationMiddleware.checkRole(['admin', 'doctor', 'nurse']),
  labResultController.addManualLabResult
);

// Get lab results for a patient
router.get('/patient/:patientId',
  authorizationMiddleware.checkPatientAccess('patientId'),
  labResultController.getPatientLabResults
);

// Get counts of lab results by status
router.get('/counts/:patientId',
  authorizationMiddleware.checkPatientAccess('patientId'),
  labResultController.getLabResultCounts
);

// Get history for a specific test
router.get('/test-history/:patientId/:testCode',
  authorizationMiddleware.checkPatientAccess('patientId'),
  labResultController.getTestHistory
);

// Get by ID
router.get('/:id',
  labResultController.getLabResultById
);

// Update review status
router.patch('/:id/review',
  authorizationMiddleware.checkRole(['admin', 'doctor']),
  labResultController.updateReviewStatus
);

module.exports = router;
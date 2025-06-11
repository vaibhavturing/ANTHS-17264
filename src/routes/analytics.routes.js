const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Reports
router.post('/reports',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'create'),
  analyticsController.generateReport
);

router.get('/reports',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'read'),
  analyticsController.getReports
);

router.get('/reports/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'read'),
  analyticsController.getReportById
);

router.post('/reports/export',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'export'),
  analyticsController.exportReport
);

// Treatment outcomes
router.post('/treatment-outcomes',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'create'),
  analyticsController.recordTreatmentOutcome
);

router.get('/treatment-outcomes/patient/:patientId',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'read'),
  analyticsController.getPatientTreatmentOutcomes
);

// Population health metrics
router.post('/population-health',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'create'),
  analyticsController.recordPopulationHealthMetric
);

router.get('/population-health',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'read'),
  analyticsController.getPopulationHealthMetrics
);

// Insights
router.post('/insights',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('analytics', 'read'),
  analyticsController.generateInsights
);

module.exports = router;
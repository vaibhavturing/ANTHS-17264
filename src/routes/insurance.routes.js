const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insurance.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Insurance providers routes
router.post('/providers',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceProviders', 'create'),
  insuranceController.createInsuranceProvider
);

router.get('/providers',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceProviders', 'read'),
  insuranceController.getInsuranceProviders
);

router.get('/providers/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceProviders', 'read'),
  insuranceController.getInsuranceProviderById
);

router.put('/providers/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceProviders', 'update'),
  insuranceController.updateInsuranceProvider
);

// Insurance plans routes
router.post('/plans',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insurancePlans', 'create'),
  insuranceController.createInsurancePlan
);

router.get('/plans',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insurancePlans', 'read'),
  insuranceController.getInsurancePlans
);

router.get('/plans/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insurancePlans', 'read'),
  insuranceController.getInsurancePlanById
);

router.put('/plans/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insurancePlans', 'update'),
  insuranceController.updateInsurancePlan
);

// Patient insurance routes
router.post('/patient',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientInsurance', 'create'),
  insuranceController.addPatientInsurance
);

router.get('/patient/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientInsurance', 'read'),
  insuranceController.getPatientInsurances
);

router.get('/patient/insurance/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientInsurance', 'read'),
  insuranceController.getPatientInsuranceById
);

router.put('/patient/insurance/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientInsurance', 'update'),
  insuranceController.updatePatientInsurance
);

// Insurance verification route
router.post('/verify',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('patientInsurance', 'verify'),
  insuranceController.verifyInsurance
);

module.exports = router;
const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Billing routes
router.post('/',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('billing', 'create'),
  billingController.createBilling
);

router.get('/',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getBillings
);

router.get('/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getBillingById
);

router.put('/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('billing', 'update'),
  billingController.updateBilling
);

router.delete('/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('billing', 'delete'),
  billingController.deleteBilling
);

// Patient-specific billing routes
router.get('/patient/:patientId/history',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getPatientBillingHistory
);

router.get('/patient/:patientId/balance',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getPatientOutstandingBalance
);

// Insurance claim routes
router.post('/claims',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceClaims', 'create'),
  billingController.createInsuranceClaim
);

router.get('/claims',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceClaims', 'read'),
  billingController.getInsuranceClaims
);

router.get('/claims/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceClaims', 'read'),
  billingController.getInsuranceClaimById
);

router.put('/claims/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('insuranceClaims', 'update'),
  billingController.updateInsuranceClaim
);

// Payment routes
router.post('/payments',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('payments', 'create'),
  billingController.createPayment
);

router.get('/payments/billing/:billingId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('payments', 'read'),
  billingController.getPaymentsByBilling
);

router.get('/payments/patient/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('payments', 'read'),
  billingController.getPaymentsByPatient
);

// Payment plan routes
router.post('/payment-plans',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('paymentPlans', 'create'),
  billingController.createPaymentPlan
);

router.get('/payment-plans/patient/:patientId',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('paymentPlans', 'read'),
  billingController.getPatientPaymentPlans
);

router.get('/payment-plans/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('paymentPlans', 'read'),
  billingController.getPaymentPlanById
);

router.put('/payment-plans/:id',
  authMiddleware.authenticateUser,
  permissionMiddleware.checkPermission('paymentPlans', 'update'),
  billingController.updatePaymentPlan
);

module.exports = router;
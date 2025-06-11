const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

// Billing routes
router.post('/',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('billing', 'create'),
  billingController.createBilling
);

router.get('/',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getBillings
);

router.get('/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getBillingById
);

router.put('/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('billing', 'update'),
  billingController.updateBilling
);

router.delete('/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('billing', 'delete'),
  billingController.deleteBilling
);

// Patient-specific billing routes
router.get('/patient/:patientId/history',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getPatientBillingHistory
);

router.get('/patient/:patientId/balance',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('billing', 'read'),
  billingController.getPatientOutstandingBalance
);

// Insurance claim routes
router.post('/claims',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('insuranceClaims', 'create'),
  billingController.createInsuranceClaim
);

router.get('/claims',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('insuranceClaims', 'read'),
  billingController.getInsuranceClaims
);

router.get('/claims/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('insuranceClaims', 'read'),
  billingController.getInsuranceClaimById
);

router.put('/claims/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('insuranceClaims', 'update'),
  billingController.updateInsuranceClaim
);

// Payment routes
router.post('/payments',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('payments', 'create'),
  billingController.createPayment
);

router.get('/payments/billing/:billingId',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('payments', 'read'),
  billingController.getPaymentsByBilling
);

router.get('/payments/patient/:patientId',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('payments', 'read'),
  billingController.getPaymentsByPatient
);

// Payment plan routes
router.post('/payment-plans',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('paymentPlans', 'create'),
  billingController.createPaymentPlan
);

router.get('/payment-plans/patient/:patientId',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('paymentPlans', 'read'),
  billingController.getPatientPaymentPlans
);

router.get('/payment-plans/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('paymentPlans', 'read'),
  billingController.getPaymentPlanById
);

router.put('/payment-plans/:id',
  authMiddleware.authenticate,
  permissionMiddleware.checkPermission('paymentPlans', 'update'),
  billingController.updatePaymentPlan
);

module.exports = router;
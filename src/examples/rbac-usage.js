// src/examples/rbac-usage.js
const express = require('express');
const { rbacMiddleware } = require('../middleware');
const { PermissionDecorators } = require('../utils/permission-decorators');

// Example route definition using the RBAC middleware
const router = express.Router();

// Simple permission check
router.get('/patients', 
  rbacMiddleware.requirePermission('patient', 'list'),
  (req, res) => {
    // Handler code
  }
);

// Checking ownership
router.put('/patients/:id',
  rbacMiddleware.requireOwnership({
    resource: 'patient',
    action: 'update',
    modelName: 'Patient',
    ownerField: 'userId'
  }),
  (req, res) => {
    // Handler code
  }
);

// Using role level
router.post('/doctors',
  rbacMiddleware.requireLevel(50), // Require admin level
  (req, res) => {
    // Handler code
  }
);

// Complex hierarchical permission
router.get('/departments/:id/staff',
  rbacMiddleware.requireHierarchical({
    resource: 'department',
    action: 'read',
    modelName: 'Department',
    relationshipField: 'departmentId'
  }),
  (req, res) => {
    // Handler code
  }
);

// Dynamic permission resolver
router.post('/medical-records/:type',
  rbacMiddleware.dynamicPermission(async (req) => {
    // Dynamically determine resource based on record type
    const recordType = req.params.type;
    const resource = `medicalRecord_${recordType}`;
    
    return {
      resource,
      action: 'create',
      context: {
        recordType: req.params.type,
        patientId: req.body.patientId
      }
    };
  }),
  (req, res) => {
    // Handler code
  }
);

// Custom permission check
router.delete('/sensitive-data/:id',
  rbacMiddleware.custom(async (req, user) => {
    // Custom logic goes here
    const dataId = req.params.id;
    const isOwner = await checkDataOwnership(user._id, dataId);
    
    if (isOwner) return true;
    
    // Check for admin override with request signature
    const hasAdminOverride = await verifyAdminOverride(req);
    if (hasAdminOverride) return true;
    
    return "You need special authorization to delete this sensitive data";
  }),
  (req, res) => {
    // Handler code
  }
);

// Composition of multiple permission checks
router.post('/prescriptions',
  [
    rbacMiddleware.requirePermission('prescription', 'create'),
    rbacMiddleware.requireHierarchical({
      resource: 'patient',
      action: 'prescribe',
      idParam: 'patientId',
      relationshipCheck: async (user, patient) => {
        // Custom check if doctor is assigned to this patient
        return await isPatientAssignedToDoctor(patient._id, user._id);
      },
      modelName: 'Patient'
    })
  ],
  (req, res) => {
    // Handler code
  }
);

module.exports = router;
// src/routes/auditLog.routes.js

const express = require('express');
const router = express.Router();
const AuditLogController = require('../controllers/auditLog.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');
const { 
  getLogsValidator,
  patientAccessReportValidator,
  systemAccessReportValidator
} = require('../validators/auditLog.validator');

// All routes require authentication
router.use(authMiddleware);

// Get audit logs (admin, compliance officer, security officer)
router.get(
  '/',
  roleMiddleware(['admin', 'compliance_officer', 'security_officer']),
  getLogsValidator,
  AuditLogController.getLogs
);

// Get patient access report (admin, doctor, compliance officer)
router.get(
  '/reports/patient/:patientId',
  roleMiddleware(['admin', 'doctor', 'compliance_officer']),
  patientAccessReportValidator,
  AuditLogController.getPatientAccessReport
);

// Get system access report (admin, compliance officer, security officer)
router.get(
  '/reports/system',
  roleMiddleware(['admin', 'compliance_officer', 'security_officer']),
  systemAccessReportValidator,
  AuditLogController.getSystemAccessReport
);

module.exports = router;
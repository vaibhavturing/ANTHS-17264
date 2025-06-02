/**
 * API Routes Index
 * Centralizes all route management and mounts routes to appropriate paths
 */

const express = require('express');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth.middleware');
const { auditResourceAccess } = require('../middleware/audit-logger.middleware');

// Import all route modules
const authRoutes = require('./auth.routes');
const userRoutes = require('./users.routes');
const patientRoutes = require('./patient.routes');
const doctorRoutes = require('./doctor.routes');
const appointmentRoutes = require('./appointment.routes');
const medicalRecordRoutes = require('./medical-record.routes');
const adminRoutes = require('./admin.routes');
const healthRoutes = require('./health.routes');

const router = express.Router();

/**
 * Mount all route modules to appropriate paths
 * Apply middleware specific to routes as needed
 * 
 * Route structure:
 * - /api
 *   - /auth: Authentication routes (public)
 *   - /users: User management routes (protected)
 *   - /patients: Patient management routes (protected)
 *   - /doctors: Doctor management routes (protected)
 *   - /appointments: Appointment scheduling routes (protected)
 *   - /medical-records: Medical records routes (protected, extra security)
 *   - /admin: Admin-only routes (admin protected)
 * - /health: Application health monitoring routes (partially protected)
 */

// Log all route registrations for debugging
const mountRoutes = () => {
  // Mount public routes that don't require authentication
  router.use('/auth', authRoutes);
  logger.debug('Mounted authentication routes at /api/auth');
  
  // Health routes are partially public
  router.use('/health', healthRoutes);
  logger.debug('Mounted health check routes at /health');

  // All routes below this point require authentication
  
  // User routes
  router.use(
    '/users',
    authMiddleware.authenticate, // Require valid authentication
    auditResourceAccess(),       // Audit all user data access
    userRoutes
  );
  logger.debug('Mounted user routes at /api/users with authentication');
  
  // Patient routes
  router.use(
    '/patients',
    authMiddleware.authenticate, // Require valid authentication
    auditResourceAccess(),       // Audit all patient data access (HIPAA)
    patientRoutes
  );
  logger.debug('Mounted patient routes at /api/patients with authentication');
  
  // Doctor routes
  router.use(
    '/doctors',
    authMiddleware.authenticate, // Require valid authentication
    auditResourceAccess(),       // Audit all doctor data access
    doctorRoutes
  );
  logger.debug('Mounted doctor routes at /api/doctors with authentication');
  
  // Appointment routes
  router.use(
    '/appointments',
    authMiddleware.authenticate, // Require valid authentication
    auditResourceAccess(),       // Audit all appointment data access
    appointmentRoutes
  );
  logger.debug('Mounted appointment routes at /api/appointments with authentication');
  
  // Medical records routes - enhanced security for PHI
  router.use(
    '/medical-records',
    authMiddleware.authenticate, // Require valid authentication
    authMiddleware.requireHipaaTraining, // Require HIPAA training
    auditResourceAccess(),       // Audit all medical record access (HIPAA)
    medicalRecordRoutes
  );
  logger.debug('Mounted medical record routes at /api/medical-records with enhanced security');
  
  // Admin routes - admin only
  router.use(
    '/admin',
    authMiddleware.authenticate, // Require valid authentication
    authMiddleware.requireRole('admin'), // Admin role required
    auditResourceAccess(),       // Audit all admin operations
    adminRoutes
  );
  logger.debug('Mounted admin routes at /api/admin with admin role protection');

  return router;
};

// Export the API router
module.exports = {
  routes: mountRoutes()
};
const express = require('express');
const compression = require('compression');
const config = require('./config/config');
const sessionService= require('./services/session.service');


// Import middleware
const {
  jsonParserMiddleware,
  urlencodedParserMiddleware,
  fileUpload
} = require('./middleware/request-parser.middleware');

const securityMiddleware = require('./middleware/security.middleware');
const morganMiddleware = require('./middleware/morgan.middleware');
const securityAuditLogger = require('./middleware/audit-logger.middleware');
const { auditResourceAccess, auditAuthentication } = require('./middleware/audit-logger.middleware');  // Add this line

// Add these lines in your import section of app.js
const communicationRoutes = require('./routes/communication.routes');
const patientCommunicationRoutes = require('./routes/patient-communication.routes');
const appointmentNotificationRoutes = require('./routes/appointment-notification.routes');
const prescriptionNotificationRoutes = require('./routes/prescription-notification.routes');
const medicalRecordNotificationRoutes = require('./routes/medical-record-notification.routes');
const notificationRoutes = require('./routes/notification.routes');
const scheduledTasksService = require('./services/scheduled-tasks.service');
const insuranceRoutes = require('./routes/insurance.routes'); // Added new insurance routes
const billingRoutes = require('./routes/billing.routes');     // Added new billing routes






// Import required route modules - with error handling for modules that might not exist yet
const loadRouteModule = (path) => {
  try {
    return require(path);
  } catch (error) {
    console.warn(`Warning: Could not load route module ${path}: ${error.message}`);
    return express.Router(); // Return empty router as fallback
  }
};

// Function to safely import route modules
const safeRequire = (modulePath) => {
  try {
    return require(modulePath);
  } catch (error) {
    logger.warn(`Could not load route module ${modulePath}: ${error.message}`);
    // Return an empty router to prevent application crashes
    return express.Router();
  }
};


// Load route modules
const medicalRecordRoutes = loadRouteModule('./routes/medicalRecord.routes');
const patientMedicalRecordRoutes = loadRouteModule('./routes/patient-medical-records.routes');



const {
  dynamicRateLimiter,
  authLimiter,
  adminLimiter
} = require('./middleware/rate-limit.middleware');

// Fix: Destructure adminIpWhitelist from the exported object
const { adminIpWhitelist } = require('./middleware/ip-whitelist.middleware');

const responseWrapper = require('./middleware/response-wrapper.middleware');

const routes = require('./routes');
const notFoundHandler = require('./middleware/not-found.middleware');
const errorHandler = require('./middleware/error-handler.middleware');

const app = express();

// ✅ Apply security middleware (if array, spread it)
if (Array.isArray(securityMiddleware)) {
  app.use(...securityMiddleware);
} else {
  app.use(securityMiddleware);
}


// Add these routes to your app in the routes section
app.use('/api/communications', communicationRoutes);
app.use('/api/patients', patientCommunicationRoutes);
app.use('/api/appointments', appointmentNotificationRoutes);
app.use('/api/prescriptions', prescriptionNotificationRoutes);
app.use('/api/medical-records', medicalRecordNotificationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/insurance', insuranceRoutes); // Added new insurance routes
app.use('/api/billing', billingRoutes);     // Added new billing routes


// Parse request bodies
app.use(jsonParserMiddleware());
app.use(urlencodedParserMiddleware());
app.use(fileUpload.any()); // Accept all file uploads

// Register routes
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/patients', patientMedicalRecordRoutes);

// Apply compression
app.use(compression());

app.use(express.static('public')); // Serve static files from 'public' directory

// Logging middleware
app.use(morganMiddleware);

// Apply security audit logging if enabled
// if (config.features?.auditLogging) {
//   app.use(securityAuditLogger);
// }

// ✅ Rate Limiting and Access Controls

// General dynamic rate limiter for all API routes
app.use(`/api/${config.apiVersion}`, dynamicRateLimiter);

// Stricter limiter for authentication routes
app.use(`/api/${config.apiVersion}/auth`, authLimiter);

// Admin IP whitelist check
app.use(`/api/${config.apiVersion}/admin`, adminIpWhitelist);

// Response wrapper middleware for consistent API output
app.use(`/api/${config.apiVersion}`, responseWrapper({
  defaultMessages: {
    list: 'Data retrieved successfully',
    retrieve: 'Resource retrieved successfully',
    created: 'Resource created successfully',
    update: 'Resource updated successfully',
    delete: 'Resource deleted successfully'
  },
  excludePaths: [
    `/api/${config.apiVersion}/health`,
    `/api/${config.apiVersion}/download`
  ]
}));

// API routes
app.use(`/api/${config.apiVersion}`, routes);


// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug security info endpoint (non-production only)
if (config.env !== 'production') {
  app.get('/api/security-info', (req, res) => {
    res.status(200).json({
      environment: config.env,
      securityHeaders: true,
      csrfProtection: true,
      rateLimit: {
        enabled: true,
        windowMs: config.security.rateLimit?.windowMs,
        max: config.security.rateLimit?.max
      },
      cors: {
        enabled: true,
        whitelist: config.security.cors?.whitelist
      },
      ipWhitelisting: {
        adminRoutes: config.security.adminIpWhitelist?.length > 0,
        sensitiveOperations: config.security.ipWhitelist?.length > 0
      },
      auditLogging: config.features?.auditLogging
    });
  });
}

// Audit logging middleware
app.use(auditAuthentication());  // Add this line
app.use(auditResourceAccess());  // Add this line

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);



module.exports = app;
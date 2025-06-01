const express = require('express');
const compression = require('compression');
const config = require('./config/config');

// Import middleware
const {
  jsonParserMiddleware,
  urlencodedParserMiddleware,
  fileUpload
} = require('./middleware/request-parser.middleware');

const securityMiddleware = require('./middleware/security.middleware');
const morganMiddleware = require('./middleware/morgan.middleware');
const securityAuditLogger = require('./middleware/audit-logger.middleware');

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

// Parse request bodies
app.use(jsonParserMiddleware());
app.use(urlencodedParserMiddleware());
app.use(fileUpload.any()); // Accept all file uploads

// Apply compression
app.use(compression());

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

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
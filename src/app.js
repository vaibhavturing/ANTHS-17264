/**
 * Healthcare Management Application
 * Express Application Configuration
 * 
 * Sets up the Express application with all middleware and routes
 */

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

// Import configuration
const config = require('./config/config');

// Import middleware
const morganMiddleware = require('./middleware/morgan.middleware');
const {
  helmetMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
  xssMiddleware,
  mongoSanitizeMiddleware,
  hppMiddleware,
  securityHeadersMiddleware
} = require('./middleware/security.middleware');
const compressionMiddleware = require('./middleware/compression.middleware');
const {
  jsonParserMiddleware,
  urlencodedParserMiddleware
} = require('./middleware/request-parser.middleware');
const errorHandlerMiddleware = require('./middleware/error-handler.middleware');
const notFoundMiddleware = require('./middleware/not-found.middleware');

// Import routes
const authRoutes = require('./routes/auth.routes');
const patientRoutes = require('./routes/patient.routes');
const doctorRoutes = require('./routes/doctor.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const medicalRecordRoutes = require('./routes/medicalRecord.routes');

// Create Express application
const app = express();

// Set security HTTP headers with Helmet
app.use(helmetMiddleware());
app.use(securityHeadersMiddleware());

// Enable CORS
app.use(corsMiddleware());

// Request logging
app.use(morganMiddleware());

// Body parsers
app.use(jsonParserMiddleware());
app.use(urlencodedParserMiddleware());

// Cookie parser
app.use(cookieParser());

// Security middleware
app.use(xssMiddleware());
app.use(mongoSanitizeMiddleware());
app.use(hppMiddleware());

// Compression middleware
app.use(compressionMiddleware());

// Rate limiting (apply to API routes only)
app.use('/api', rateLimitMiddleware());

// API Routes
const apiRouter = express.Router();
const apiVersion = 'v1';

// Mount API version routes
apiRouter.use(`/${apiVersion}/auth`, authRoutes);
apiRouter.use(`/${apiVersion}/patients`, patientRoutes);
apiRouter.use(`/${apiVersion}/doctors`, doctorRoutes);
apiRouter.use(`/${apiVersion}/appointments`, appointmentRoutes);
apiRouter.use(`/${apiVersion}/medical-records`, medicalRecordRoutes);

// Mount API router to main app
app.use('/api', apiRouter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Healthcare Management API is running',
    environment: config.env,
    timestamp: new Date()
  });
});

// Handle undefined routes (404)
app.use(notFoundMiddleware);

// Global error handling
app.use(errorHandlerMiddleware);

module.exports = app;
/**
 * Healthcare Management Application
 * Express Application Configuration
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/notFoundHandler');
const logger = require('./utils/logger');
const config = require('./config/config');

// Initialize express app
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.originalUrl}`);
  next();
});

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs, 
  max: config.security.rateLimit.max,
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api', limiter);

// Body parser middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// API Routes
// These routes will be implemented later
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/patients', require('./routes/patient.routes'));
app.use('/api/v1/appointments', require('./routes/appointment.routes'));
app.use('/api/v1/doctors', require('./routes/doctor.routes'));
app.use('/api/v1/medical-records', require('./routes/medicalRecord.routes'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Healthcare Management API is running',
    environment: config.env,
    timestamp: new Date()
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler middleware
app.use(errorHandler);

module.exports = app;
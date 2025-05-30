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

// Initialize express app
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes
// app.use('/api/v1/auth', require('./routes/auth.routes'));
// app.use('/api/v1/patients', require('./routes/patient.routes'));
// app.use('/api/v1/appointments', require('./routes/appointment.routes'));
// app.use('/api/v1/doctors', require('./routes/doctor.routes'));
// app.use('/api/v1/medical-records', require('./routes/medicalRecord.routes'));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Healthcare Management API is running'
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler middleware
app.use(errorHandler);

module.exports = app;
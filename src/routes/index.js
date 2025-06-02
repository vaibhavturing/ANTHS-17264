const express = require('express');
const router = express.Router();

// Import each route file (each must export an Express router)
const adminRoutes = require('./admin.routes');
const appointmentRoutes = require('./appointment.routes');
const authRoutes = require('./auth.routes');
const doctorRoutes = require('./doctor.routes');
const medicalRecordRoutes = require('./medicalRecord.routes');
const patientRoutes = require('./patient.routes');
const healthRoutes = require('./health.routes');  // Add this line


// Mount the route handlers on their respective paths
router.use('/admin', adminRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/auth', authRoutes);
router.use('/doctors', doctorRoutes);
router.use('/medical-records', medicalRecordRoutes);
router.use('/patients', patientRoutes);
router.use('/health', healthRoutes);

module.exports = router;
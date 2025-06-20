// src/routes/monitor.routes.js
const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitor.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Protect monitoring routes with authentication and admin authorization
router.get('/dashboard', authenticate, authorize(['admin']), monitorController.getDashboard);

module.exports = router;
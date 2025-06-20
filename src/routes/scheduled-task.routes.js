// src/routes/scheduled-task.routes.js
const express = require('express');
const router = express.Router();
const scheduledTaskController = require('../controllers/scheduled-task.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// Apply authentication middleware to all routes
router.use(authenticate);

// Only allow admins to trigger scheduled tasks
router.use(authorize(['admin']));

// Run a scheduled task now
router.post(
  '/:taskName/run',
  scheduledTaskController.runTaskNow
);

module.exports = router;
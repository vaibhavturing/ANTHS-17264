const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendar.controller');
const authMiddleware = require('../middleware/auth.middleware');
const permissionMiddleware = require('../middleware/permission.middleware');

/**
 * Calendar routes
 * @route /api/calendar
 */

// Admin calendar dashboard (multiple doctors)
router.get('/admin', 
  authMiddleware.protect, 
  permissionMiddleware.restrictTo('admin'), 
  calendarController.getAdminCalendar
);

// Doctor calendar with flexible view options
router.get('/doctor/:doctorId', 
  authMiddleware.protect, 
  calendarController.getDoctorCalendar
);

// Daily calendar for doctor
router.get('/doctor/:doctorId/day/:date?', 
  authMiddleware.protect, 
  calendarController.getDoctorDailyCalendar
);

// Weekly calendar for doctor
router.get('/doctor/:doctorId/week/:date?', 
  authMiddleware.protect, 
  calendarController.getDoctorWeeklyCalendar
);

// Monthly calendar for doctor
router.get('/doctor/:doctorId/month/:date?', 
  authMiddleware.protect, 
  calendarController.getDoctorMonthlyCalendar
);

module.exports = router;
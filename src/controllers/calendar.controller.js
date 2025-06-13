const calendarService = require('../services/calendar.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const { ValidationError } = require('../utils/errors');
const Joi = require('joi');

/**
 * Validation schema for calendar requests
 */
const calendarValidator = {
  getDoctorCalendar: Joi.object({
    date: Joi.date().iso(),
    view: Joi.string().valid('day', 'week', 'month').default('month'),
    includeAvailability: Joi.boolean().default(true),
    includeHolidays: Joi.boolean().default(true),
    includeBlockedTime: Joi.boolean().default(true)
  }),
  
  getAdminCalendar: Joi.object({
    date: Joi.date().iso(),
    view: Joi.string().valid('day', 'week', 'month').default('month'),
    doctorIds: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
    departmentId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    includeAvailability: Joi.boolean().default(true),
    includeHolidays: Joi.boolean().default(true),
    includeBlockedTime: Joi.boolean().default(true)
  })
};

/**
 * Controller for calendar operations in the Healthcare Management Application
 */
const calendarController = {
  /**
   * Get calendar data for a specific doctor
   * @route GET /api/calendar/doctor/:doctorId
   * @access Private
   */
  getDoctorCalendar: asyncHandler(async (req, res) => {
    // Validate query parameters
    const { error, value } = calendarValidator.getDoctorCalendar.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid calendar request', error.details);
    }
    
    const doctorId = req.params.doctorId;
    
    // Process query parameters
    const options = {
      view: value.view || 'month',
      date: value.date ? new Date(value.date) : new Date(),
      includeAvailability: value.includeAvailability !== false,
      includeHolidays: value.includeHolidays !== false,
      includeBlockedTime: value.includeBlockedTime !== false
    };
    
    const calendarData = await calendarService.getDoctorCalendar(doctorId, options);
    
    return ResponseUtil.success(res, { 
      calendar: calendarData
    });
  }),
  
  /**
   * Get calendar data for admin dashboard (multiple doctors)
   * @route GET /api/calendar/admin
   * @access Private (Admin)
   */
  getAdminCalendar: asyncHandler(async (req, res) => {
    // Validate query parameters
    const { error, value } = calendarValidator.getAdminCalendar.validate(req.query);
    if (error) {
      throw new ValidationError('Invalid calendar request', error.details);
    }
    
    // Process query parameters
    const options = {
      view: value.view || 'day',
      date: value.date ? new Date(value.date) : new Date(),
      doctorIds: value.doctorIds || [],
      departmentId: value.departmentId,
      includeAvailability: value.includeAvailability !== false,
      includeHolidays: value.includeHolidays !== false,
      includeBlockedTime: value.includeBlockedTime !== false
    };
    
    const calendarData = await calendarService.getAdminCalendar(options);
    
    return ResponseUtil.success(res, { 
      calendar: calendarData
    });
  }),
  
  /**
   * Get calendar data for a specific doctor on a specific date
   * @route GET /api/calendar/doctor/:doctorId/day/:date
   * @access Private
   */
  getDoctorDailyCalendar: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId;
    const date = req.params.date ? new Date(req.params.date) : new Date();
    
    const options = {
      view: 'day',
      date,
      includeAvailability: true,
      includeHolidays: true,
      includeBlockedTime: true
    };
    
    const calendarData = await calendarService.getDoctorCalendar(doctorId, options);
    
    return ResponseUtil.success(res, { 
      calendar: calendarData
    });
  }),
  
  /**
   * Get calendar data for a specific doctor for a week
   * @route GET /api/calendar/doctor/:doctorId/week/:date
   * @access Private
   */
  getDoctorWeeklyCalendar: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId;
    const date = req.params.date ? new Date(req.params.date) : new Date();
    
    const options = {
      view: 'week',
      date,
      includeAvailability: true,
      includeHolidays: true,
      includeBlockedTime: true
    };
    
    const calendarData = await calendarService.getDoctorCalendar(doctorId, options);
    
    return ResponseUtil.success(res, { 
      calendar: calendarData
    });
  }),
  
  /**
   * Get calendar data for a specific doctor for a month
   * @route GET /api/calendar/doctor/:doctorId/month/:date
   * @access Private
   */
  getDoctorMonthlyCalendar: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId;
    const date = req.params.date ? new Date(req.params.date) : new Date();
    
    const options = {
      view: 'month',
      date,
      includeAvailability: true,
      includeHolidays: true,
      includeBlockedTime: true
    };
    
    const calendarData = await calendarService.getDoctorCalendar(doctorId, options);
    
    return ResponseUtil.success(res, { 
      calendar: calendarData
    });
  })
};

module.exports = calendarController;
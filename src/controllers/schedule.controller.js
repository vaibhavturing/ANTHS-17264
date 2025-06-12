// File: src/controllers/schedule.controller.js
const scheduleService = require('../services/schedule.service');
const asyncHandler = require('../utils/async-handler.util');
const { ResponseUtil } = require('../utils/response.util');
const { ApiError } = require('../utils/errors');
const moment = require('moment');

/**
 * Schedule Controller
 * Handles API requests related to doctor schedules and templates
 */
const scheduleController = {
  /**
   * Create a new recurring schedule template
   */
  createRecurringTemplate: asyncHandler(async (req, res) => {
    const templateData = req.body;
    templateData.doctor = templateData.doctor || req.user._id;
    
    const template = await scheduleService.createRecurringTemplate(templateData);
    
    return ResponseUtil.success(res, {
      message: 'Recurring schedule template created successfully',
      template
    }, 201);
  }),
  
  /**
   * Update a recurring schedule template
   */
  updateRecurringTemplate: asyncHandler(async (req, res) => {
    const { templateId } = req.params;
    const updateData = req.body;
    
    const template = await scheduleService.updateRecurringTemplate(templateId, updateData);
    
    return ResponseUtil.success(res, {
      message: 'Recurring schedule template updated successfully',
      template
    });
  }),
  
  /**
   * Get all recurring templates for a doctor
   */
  getDoctorTemplates: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId || req.user._id;
    const activeOnly = req.query.activeOnly === 'true';
    
    const templates = await scheduleService.getDoctorTemplates(doctorId, activeOnly);
    
    return ResponseUtil.success(res, {
      count: templates.length,
      templates
    });
  }),
  
  /**
   * Generate doctor schedules for a date range
   */
  generateScheduleRange: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId || req.user._id;
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      throw new ApiError('Start date and end date are required', 400);
    }
    
    const schedules = await scheduleService.generateScheduleRange(
      doctorId,
      new Date(startDate),
      new Date(endDate)
    );
    
    return ResponseUtil.success(res, {
      message: 'Schedules generated successfully',
      count: schedules.length,
      schedules
    });
  }),
  
  /**
   * Get doctor schedule for a specific day
   */
  getDoctorScheduleForDay: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId;
    const date = req.query.date || new Date();
    
    const schedule = await scheduleService.getDoctorScheduleForDay(doctorId, date);
    
    return ResponseUtil.success(res, { schedule });
  }),
  
  /**
   * Get doctor schedules by date range
   */
  getDoctorSchedulesByDateRange: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId;
    const startDate = req.query.startDate || moment().startOf('day').toDate();
    const endDate = req.query.endDate || moment().add(7, 'days').endOf('day').toDate();
    
    const schedules = await scheduleService.getDoctorSchedulesByDateRange(
      doctorId,
      startDate,
      endDate
    );
    
    return ResponseUtil.success(res, {
      count: schedules.length,
      schedules
    });
  }),
  
  /**
   * Update a doctor's schedule
   */
  updateDoctorSchedule: asyncHandler(async (req, res) => {
    const { scheduleId } = req.params;
    const updateData = req.body;
    const userId = req.user._id;
    
    const schedule = await scheduleService.updateDoctorSchedule(
      scheduleId,
      updateData,
      userId
    );
    
    return ResponseUtil.success(res, {
      message: 'Doctor schedule updated successfully',
      schedule
    });
  }),
  
  /**
   * Check for schedule conflicts
   */
  checkScheduleConflicts: asyncHandler(async (req, res) => {
    const { doctorId, startTime, endTime } = req.body;
    
    if (!doctorId || !startTime || !endTime) {
      throw new ApiError('Doctor ID, start time, and end time are required', 400);
    }
    
    const result = await scheduleService.checkScheduleConflicts(
      doctorId,
      new Date(startTime),
      new Date(endTime)
    );
    
    return ResponseUtil.success(res, result);
  })
};

module.exports = scheduleController;
const availabilityService = require('../services/availability.service');
const { ResponseUtil } = require('../utils/response.util');
const asyncHandler = require('../utils/async-handler.util');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

/**
 * Controller for doctor availability operations
 */
const availabilityController = {
  /**
   * Get doctor availability
   * @route GET /api/doctors/:doctorId/availability
   */
  getDoctorAvailability: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const availability = await availabilityService.getDoctorAvailability(doctorId);
    return ResponseUtil.success(res, { availability });
  }),

  /**
   * Update doctor working hours
   * @route PUT /api/doctors/:doctorId/availability/working-hours
   */
  updateWorkingHours: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const { workingHours } = req.body;
    
    const availability = await availabilityService.updateWorkingHours(doctorId, workingHours);
    return ResponseUtil.success(res, { 
      message: 'Working hours updated successfully', 
      availability 
    });
  }),

  /**
   * Add or update a special date
   * @route POST /api/doctors/:doctorId/availability/special-dates
   */
  addSpecialDate: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const specialDate = req.body;
    
    const availability = await availabilityService.addSpecialDate(doctorId, specialDate);
    return ResponseUtil.success(res, { 
      message: 'Special date added successfully', 
      availability 
    }, 201);
  }),

  /**
   * Remove a special date
   * @route DELETE /api/doctors/:doctorId/availability/special-dates/:specialDateId
   */
  removeSpecialDate: asyncHandler(async (req, res) => {
    const { doctorId, specialDateId } = req.params;
    
    const availability = await availabilityService.removeSpecialDate(doctorId, specialDateId);
    return ResponseUtil.success(res, { 
      message: 'Special date removed successfully', 
      availability 
    });
  }),

  /**
   * Create a leave request
   * @route POST /api/doctors/:doctorId/leaves
   */
  createLeave: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const leaveData = {
      ...req.body,
      doctorId
    };
    
    // If user is admin, they can auto-approve
    if (req.user.role === 'admin') {
      leaveData.requestedBy = req.user.id;
      leaveData.autoApprove = true;
    }
    
    const leave = await availabilityService.createLeave(leaveData);
    return ResponseUtil.success(res, { 
      message: 'Leave request created successfully', 
      leave 
    }, 201);
  }),

  /**
   * Get all leaves for a doctor
   * @route GET /api/doctors/:doctorId/leaves
   */
  getDoctorLeaves: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const filters = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const leaves = await availabilityService.getDoctorLeaves(doctorId, filters);
    return ResponseUtil.success(res, { leaves });
  }),

  /**
   * Get leave by ID
   * @route GET /api/leaves/:leaveId
   */
  getLeaveById: asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    const leave = await availabilityService.getLeaveById(leaveId);
    return ResponseUtil.success(res, { leave });
  }),

  /**
   * Update leave request
   * @route PUT /api/leaves/:leaveId
   */
  updateLeave: asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    const updates = req.body;
    
    // If updating status to approved, set approvedBy
    if (updates.status === 'approved') {
      updates.approvedBy = req.user.id;
    }
    
    const leave = await availabilityService.updateLeave(leaveId, updates);
    return ResponseUtil.success(res, { 
      message: 'Leave updated successfully', 
      leave 
    });
  }),

  /**
   * Delete leave request
   * @route DELETE /api/leaves/:leaveId
   */
  deleteLeave: asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    await availabilityService.deleteLeave(leaveId);
    return ResponseUtil.success(res, { message: 'Leave deleted successfully' });
  }),

  /**
   * Process affected appointments
   * @route POST /api/leaves/:leaveId/process-appointments
   */
  processAffectedAppointments: asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    
    // Only admins can manually trigger this process
    if (req.user.role !== 'admin') {
      throw new ValidationError('Only administrators can process affected appointments');
    }
    
    const result = await availabilityService._processAffectedAppointments(leaveId);
    return ResponseUtil.success(res, result);
  }),

  /**
   * Create a break time
   * @route POST /api/doctors/:doctorId/breaks
   */
  createBreakTime: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const breakData = {
      ...req.body,
      doctorId
    };
    
    const breakTime = await availabilityService.createBreakTime(breakData);
    return ResponseUtil.success(res, { 
      message: 'Break time created successfully', 
      breakTime 
    }, 201);
  }),

  /**
   * Get all break times for a doctor
   * @route GET /api/doctors/:doctorId/breaks
   */
  getDoctorBreakTimes: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const filters = {
      isActive: req.query.isActive === 'true',
      dayOfWeek: req.query.dayOfWeek !== undefined ? parseInt(req.query.dayOfWeek) : undefined,
      effectiveDate: req.query.effectiveDate
    };
    
    const breakTimes = await availabilityService.getDoctorBreakTimes(doctorId, filters);
    return ResponseUtil.success(res, { breakTimes });
  }),

  /**
   * Update break time
   * @route PUT /api/breaks/:breakTimeId
   */
  updateBreakTime: asyncHandler(async (req, res) => {
    const { breakTimeId } = req.params;
    const updates = req.body;
    
    const breakTime = await availabilityService.updateBreakTime(breakTimeId, updates);
    return ResponseUtil.success(res, { 
      message: 'Break time updated successfully', 
      breakTime 
    });
  }),

  /**
   * Delete break time
   * @route DELETE /api/breaks/:breakTimeId
   */
  deleteBreakTime: asyncHandler(async (req, res) => {
    const { breakTimeId } = req.params;
    await availabilityService.deleteBreakTime(breakTimeId);
    return ResponseUtil.success(res, { message: 'Break time deleted successfully' });
  }),

  /**
   * Check if a doctor is available
   * @route GET /api/doctors/:doctorId/check-availability
   */
  checkDoctorAvailability: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const { date, startTime, endTime } = req.query;
    
    if (!date || !startTime || !endTime) {
      throw new ValidationError('Date, start time, and end time are required');
    }
    
    const isAvailable = await availabilityService.isDoctorAvailable(
      doctorId,
      new Date(date),
      startTime,
      endTime
    );
    
    return ResponseUtil.success(res, { isAvailable });
  }),

  /**
   * Get calendar events for a doctor
   * @route GET /api/doctors/:doctorId/calendar
   */
  getDoctorCalendar: asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }
    
    const calendarEvents = await availabilityService.getDoctorCalendar(
      doctorId,
      new Date(startDate),
      new Date(endDate)
    );
    
    return ResponseUtil.success(res, { calendarEvents });
  })
};

module.exports = availabilityController;
// File: src/controllers/availability.controller.js
const availabilityService = require('../services/availability.service');
const asyncHandler = require('../utils/async-handler.util');
const { ResponseUtil } = require('../utils/response.util');
const { ApiError } = require('../utils/errors');
const moment = require('moment');

/**
 * Availability Controller
 * Handles API requests related to doctor availability, leaves, and breaks
 */
const availabilityController = {
  /**
   * Create a doctor's availability configuration
   */
  createAvailability: asyncHandler(async (req, res) => {
    const availabilityData = req.body;
    
    // Set doctor ID to current user if not provided
    availabilityData.doctor = availabilityData.doctor || req.user._id;
    
    const availability = await availabilityService.createAvailability(availabilityData);
    
    return ResponseUtil.success(res, {
      message: 'Availability configuration created successfully',
      availability
    }, 201);
  }),
  
  /**
   * Update a doctor's availability configuration
   */
  updateAvailability: asyncHandler(async (req, res) => {
    const { availabilityId } = req.params;
    const updateData = req.body;
    
    const availability = await availabilityService.updateAvailability(
      availabilityId,
      updateData
    );
    
    return ResponseUtil.success(res, {
      message: 'Availability configuration updated successfully',
      availability
    });
  }),
  
  /**
   * Create a new leave request
   */
  createLeaveRequest: asyncHandler(async (req, res) => {
    const leaveData = req.body;
    
    // Set doctor ID to current user if not provided
    leaveData.doctor = leaveData.doctor || req.user._id;
    
    const leave = await availabilityService.createLeaveRequest(leaveData);
    
    return ResponseUtil.success(res, {
      message: 'Leave request created successfully',
      leave
    }, 201);
  }),
  
  /**
   * Update a leave request status
   */
  updateLeaveStatus: asyncHandler(async (req, res) => {
    const { leaveId } = req.params;
    const { status, notes } = req.body;
    const approverId = req.user._id;
    
    if (!status || !['approved', 'rejected', 'cancelled'].includes(status)) {
      throw new ApiError('Valid status (approved, rejected, cancelled) is required', 400);
    }
    
    const leave = await availabilityService.updateLeaveStatus(
      leaveId,
      status,
      approverId,
      notes
    );
    
    return ResponseUtil.success(res, {
      message: `Leave request ${status} successfully`,
      leave
    });
  }),
  
  /**
   * Get all leave requests for a doctor
   */
  getDoctorLeaves: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId || req.user._id;
    const filters = {
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const leaves = await availabilityService.getDoctorLeaves(doctorId, filters);
    
    return ResponseUtil.success(res, {
      count: leaves.length,
      leaves
    });
  }),
  
  /**
   * Schedule a break for a doctor
   */
  scheduleBreak: asyncHandler(async (req, res) => {
    const breakData = req.body;
    
    // Set doctor ID to current user if not provided
    breakData.doctor = breakData.doctor || req.user._id;
    
    const breakTime = await availabilityService.scheduleBreak(breakData);
    
    return ResponseUtil.success(res, {
      message: 'Break scheduled successfully',
      break: breakTime
    }, 201);
  }),
  
  /**
   * Update a scheduled break
   */
  updateBreak: asyncHandler(async (req, res) => {
    const { breakId } = req.params;
    const updateData = req.body;
    
    const breakTime = await availabilityService.updateBreak(
      breakId,
      updateData
    );
    
    return ResponseUtil.success(res, {
      message: 'Break updated successfully',
      break: breakTime
    });
  }),
  
  /**
   * Get all breaks for a doctor by date range
   */
  getDoctorBreaks: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId || req.user._id;
    const startDate = req.query.startDate || moment().startOf('day').toDate();
    const endDate = req.query.endDate || moment().add(7, 'days').endOf('day').toDate();
    
    const breaks = await availabilityService.getDoctorBreaks(
      doctorId,
      new Date(startDate),
      new Date(endDate)
    );
    
    return ResponseUtil.success(res, {
      count: breaks.length,
      breaks
    });
  }),
  
  /**
   * Get doctor availability information for a date
   */
  getDoctorAvailabilityForDate: asyncHandler(async (req, res) => {
    const doctorId = req.params.doctorId;
    const date = req.query.date || new Date();
    
    const availability = await availabilityService.getDoctorAvailabilityForDate(
      doctorId,
      date
    );
    
    return ResponseUtil.success(res, { availability });
  }),
  
  /**
   * Check doctor availability for a specific time slot
   */
  checkDoctorAvailability: asyncHandler(async (req, res) => {
    const { doctorId, startTime, endTime } = req.body;
    
    if (!doctorId || !startTime || !endTime) {
      throw new ApiError('Doctor ID, start time, and end time are required', 400);
    }
    
    const result = await availabilityService.checkDoctorAvailability(
      doctorId,
      new Date(startTime),
      new Date(endTime)
    );
    
    return ResponseUtil.success(res, result);
  })
};

module.exports = availabilityController;
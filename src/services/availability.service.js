// File: src/services/availability.service.js
const { BreakTime, Leave, Availability } = require('../models/availability.model');
const scheduleService = require('./schedule.service');
const userService = require('./user.service'); // Assuming this exists
const moment = require('moment');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');
const mongoose = require('mongoose');

/**
 * Availability Service
 * Handles doctor availability, leave requests, and break time management
 */
const availabilityService = {
  /**
   * Create a doctor's availability configuration
   * @param {Object} availabilityData - The availability data
   * @returns {Promise<Object>} Created availability
   */
  createAvailability: async (availabilityData) => {
    try {
      // Check if an availability record already exists for this date range
      const existingAvailability = await Availability.findOne({
        doctor: availabilityData.doctor,
        $or: [
          {
            effectiveFrom: { $lte: availabilityData.effectiveFrom },
            effectiveUntil: { $gte: availabilityData.effectiveFrom }
          },
          {
            effectiveFrom: { $lte: availabilityData.effectiveUntil },
            effectiveUntil: { $gte: availabilityData.effectiveUntil }
          },
          {
            effectiveFrom: { $gte: availabilityData.effectiveFrom },
            effectiveUntil: { $lte: availabilityData.effectiveUntil }
          }
        ]
      });
      
      if (existingAvailability) {
        throw new ApiError(
          'An availability record already exists for this date range',
          400
        );
      }
      
      const availability = new Availability(availabilityData);
      await availability.save();
      
      logger.info('Created new doctor availability configuration', {
        doctorId: availability.doctor,
        availabilityId: availability._id
      });
      
      return availability;
    } catch (error) {
      logger.error('Failed to create availability configuration', {
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Update a doctor's availability configuration
   * @param {string} availabilityId - The availability record ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated availability
   */
  updateAvailability: async (availabilityId, updateData) => {
    try {
      const availability = await Availability.findById(availabilityId);
      
      if (!availability) {
        throw new ApiError('Availability record not found', 404);
      }
      
      // Apply updates
      Object.keys(updateData).forEach(key => {
        availability[key] = updateData[key];
      });
      
      await availability.save();
      
      logger.info('Updated doctor availability configuration', {
        availabilityId,
        doctorId: availability.doctor
      });
      
      return availability;
    } catch (error) {
      logger.error('Failed to update availability configuration', {
        availabilityId,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Create a new leave request
   * @param {Object} leaveData - The leave request data
   * @returns {Promise<Object>} Created leave request
   */
  createLeaveRequest: async (leaveData) => {
    try {
      // Validate leave dates
      if (moment(leaveData.startDateTime).isAfter(moment(leaveData.endDateTime))) {
        throw new ApiError('Leave start date must be before end date', 400);
      }
      
      // Create the leave request
      const leave = new Leave(leaveData);
      await leave.save();
      
      logger.info('Created new leave request', {
        doctorId: leave.doctor,
        leaveId: leave._id,
        leaveType: leave.leaveType,
        startDate: leave.startDateTime
      });
      
      // If leave is pre-approved, apply it to the schedule
      if (leave.status === 'approved') {
        await scheduleService.applyLeaveToSchedule(leave);
      }
      
      return leave;
    } catch (error) {
      logger.error('Failed to create leave request', {
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Update a leave request status
   * @param {string} leaveId - The leave request ID
   * @param {string} status - The new status
   * @param {string} approverId - ID of the user approving/rejecting
   * @param {string} notes - Approval/rejection notes
   * @returns {Promise<Object>} Updated leave request
   */
  updateLeaveStatus: async (leaveId, status, approverId, notes = '') => {
    try {
      const leave = await Leave.findById(leaveId);
      
      if (!leave) {
        throw new ApiError('Leave request not found', 404);
      }
      
      // Update leave status
      leave.status = status;
      
      // Add approval info if approved or rejected
      if (['approved', 'rejected'].includes(status)) {
        leave.approval = {
          approvedBy: approverId,
          approvedAt: new Date(),
          notes: notes
        };
      }
      
      await leave.save();
      
      logger.info(`Leave request ${status}`, {
        leaveId,
        doctorId: leave.doctor,
        approverId,
        status
      });
      
      // Apply approved leave to schedule
      if (status === 'approved') {
        await scheduleService.applyLeaveToSchedule(leave);
      }
      
      return leave;
    } catch (error) {
      logger.error('Failed to update leave status', {
        leaveId,
        status,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Get all leave requests for a doctor
   * @param {string} doctorId - The doctor's ID
   * @param {Object} filters - Filters like status, date range
   * @returns {Promise<Array>} List of leave requests
   */
  getDoctorLeaves: async (doctorId, filters = {}) => {
    try {
      const query = { doctor: doctorId };
      
      // Apply status filter
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Apply date range filters
      if (filters.startDate) {
        query.startDateTime = { $gte: new Date(filters.startDate) };
      }
      
      if (filters.endDate) {
        query.endDateTime = { $lte: new Date(filters.endDate) };
      }
      
      const leaves = await Leave.find(query)
        .sort('-startDateTime')
        .populate('approval.approvedBy', 'firstName lastName email');
      
      return leaves;
    } catch (error) {
      logger.error('Failed to get doctor leaves', {
        doctorId,
        error: error.message
      });
      throw new ApiError('Failed to retrieve leave records', 500, error.message);
    }
  },
  
  /**
   * Schedule a break for a doctor
   * @param {Object} breakData - The break data
   * @returns {Promise<Object>} Created break
   */
  scheduleBreak: async (breakData) => {
    try {
      // Validate break times
      if (moment(breakData.startTime).isAfter(moment(breakData.endTime))) {
        throw new ApiError('Break start time must be before end time', 400);
      }
      
      // Create the break
      const breakTime = new BreakTime(breakData);
      await breakTime.save();
      
      logger.info('Scheduled new break', {
        doctorId: breakTime.doctor,
        breakId: breakTime._id,
        date: breakTime.date
      });
      
      return breakTime;
    } catch (error) {
      logger.error('Failed to schedule break', {
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Update a scheduled break
   * @param {string} breakId - The break ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated break
   */
  updateBreak: async (breakId, updateData) => {
    try {
      const breakTime = await BreakTime.findById(breakId);
      
      if (!breakTime) {
        throw new ApiError('Break not found', 404);
      }
      
      // Apply updates
      Object.keys(updateData).forEach(key => {
        breakTime[key] = updateData[key];
      });
      
      await breakTime.save();
      
      logger.info('Updated scheduled break', {
        breakId,
        doctorId: breakTime.doctor
      });
      
      return breakTime;
    } catch (error) {
      logger.error('Failed to update break', {
        breakId,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Get all breaks for a doctor by date range
   * @param {string} doctorId - The doctor's ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} List of breaks
   */
  getDoctorBreaks: async (doctorId, startDate, endDate) => {
    try {
      const breaks = await BreakTime.find({
        doctor: doctorId,
        date: {
          $gte: startDate,
          $lte: endDate
        },
        status: 'scheduled'
      }).sort('date startTime');
      
      return breaks;
    } catch (error) {
      logger.error('Failed to get doctor breaks', {
        doctorId,
        startDate,
        endDate,
        error: error.message
      });
      throw new ApiError('Failed to retrieve break records', 500, error.message);
    }
  },
  
  /**
   * Get doctor availability information with schedule and conflicts
   * @param {string} doctorId - The doctor's ID
   * @param {Date} date - The date to check
   * @returns {Promise<Object>} Availability information
   */
  getDoctorAvailabilityForDate: async (doctorId, date) => {
    try {
      const dateObj = moment(date);
      const startOfDay = dateObj.clone().startOf('day').toDate();
      const endOfDay = dateObj.clone().endOf('day').toDate();
      
      // Get doctor's schedule for this day
      const schedule = await scheduleService.getDoctorScheduleForDay(doctorId, date);
      
      // Get leaves that affect this day
      const leaves = await Leave.find({
        doctor: doctorId,
        status: 'approved',
        $or: [
          {
            startDateTime: { $lte: endOfDay },
            endDateTime: { $gte: startOfDay }
          }
        ]
      });
      
      // Get breaks for this day
      const breaks = await BreakTime.find({
        doctor: doctorId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        status: 'scheduled'
      });
      
      // Get active availability configuration
      const availabilityConfig = await Availability.findOne({
        doctor: doctorId,
        effectiveFrom: { $lte: date },
        $or: [
          { effectiveUntil: null },
          { effectiveUntil: { $gte: date } }
        ],
        status: 'active'
      }).populate('availableAppointmentTypes');
      
      return {
        date: dateObj.format('YYYY-MM-DD'),
        isWorkingDay: schedule ? schedule.isWorkingDay : false,
        schedule: schedule,
        leaves: leaves,
        breaks: breaks,
        availabilityConfiguration: availabilityConfig,
        availableTimeSlots: schedule ? schedule.getAvailableTimeSlots() : []
      };
    } catch (error) {
      logger.error('Failed to get doctor availability', {
        doctorId,
        date,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Check doctor availability for a specific time slot
   * @param {string} doctorId - The doctor's ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Promise<Object>} Availability check result
   */
  checkDoctorAvailability: async (doctorId, startTime, endTime) => {
    try {
      const date = moment(startTime).startOf('day').toDate();
      
      // First check if doctor exists and is active
      const doctor = await userService.getUserById(doctorId);
      if (!doctor || doctor.role !== 'doctor' || !doctor.isActive) {
        return {
          available: false,
          reason: 'Doctor not found or inactive'
        };
      }
      
      // Check for schedule conflicts
      const conflictCheck = await scheduleService.checkScheduleConflicts(
        doctorId,
        startTime,
        endTime
      );
      
      if (conflictCheck.hasConflict) {
        return {
          available: false,
          reason: conflictCheck.reason
        };
      }
      
      // Check if doctor has active availability configuration for this date
      const availabilityConfig = await Availability.findOne({
        doctor: doctorId,
        effectiveFrom: { $lte: date },
        $or: [
          { effectiveUntil: null },
          { effectiveUntil: { $gte: date } }
        ],
        status: 'active'
      });
      
      if (!availabilityConfig) {
        return {
          available: false,
          reason: 'No availability configuration for this date'
        };
      }
      
      // Check minimum notice period
      const noticeHours = moment(startTime).diff(moment(), 'hours');
      if (noticeHours < availabilityConfig.minimumNoticeTime) {
        return {
          available: false,
          reason: `Booking requires ${availabilityConfig.minimumNoticeTime} hours advance notice`
        };
      }
      
      // Check if within maximum booking window
      const daysAhead = moment(startTime).diff(moment(), 'days');
      if (daysAhead > availabilityConfig.maximumBookingWindow) {
        return {
          available: false,
          reason: `Booking cannot be made more than ${availabilityConfig.maximumBookingWindow} days in advance`
        };
      }
      
      // Doctor is available for this time slot
      return {
        available: true,
        availabilityConfig
      };
    } catch (error) {
      logger.error('Failed to check doctor availability', {
        doctorId,
        startTime,
        endTime,
        error: error.message
      });
      throw new ApiError('Failed to check doctor availability', 500, error.message);
    }
  }
};

module.exports = availabilityService;
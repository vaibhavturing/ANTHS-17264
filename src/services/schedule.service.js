// File: src/services/schedule.service.js
const { DoctorSchedule, RecurringTemplate, TimeSlot } = require('../models/schedule.model');
const { BreakTime, Leave, Availability } = require('../models/availability.model');
const AppointmentType = require('../models/appointmentType.model');
const mongoose = require('mongoose');
const moment = require('moment');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

/**
 * Schedule Service
 * Handles all operations related to doctor scheduling
 */
const scheduleService = {
  /**
   * Create a new recurring schedule template
   * @param {Object} templateData - The template data
   * @returns {Promise<Object>} Created template
   */
  createRecurringTemplate: async (templateData) => {
    try {
      const template = new RecurringTemplate(templateData);
      await template.save();
      
      logger.info('Created new recurring schedule template', { 
        doctorId: template.doctor, 
        templateId: template._id 
      });
      
      return template;
    } catch (error) {
      logger.error('Failed to create recurring template', { error: error.message });
      throw new ApiError('Failed to create recurring template', 400, error.message);
    }
  },
  
  /**
   * Update a recurring schedule template
   * @param {string} templateId - The template ID
   * @param {Object} updateData - The data to update
   * @returns {Promise<Object>} Updated template
   */
  updateRecurringTemplate: async (templateId, updateData) => {
    try {
      const template = await RecurringTemplate.findById(templateId);
      
      if (!template) {
        throw new ApiError('Template not found', 404);
      }
      
      // Apply updates
      Object.keys(updateData).forEach(key => {
        template[key] = updateData[key];
      });
      
      await template.save();
      
      logger.info('Updated recurring schedule template', { 
        templateId, 
        doctorId: template.doctor 
      });
      
      return template;
    } catch (error) {
      logger.error('Failed to update recurring template', { 
        templateId, 
        error: error.message 
      });
      throw error;
    }
  },
  
  /**
   * Get all recurring templates for a doctor
   * @param {string} doctorId - The doctor's ID
   * @param {boolean} activeOnly - Whether to return active templates only
   * @returns {Promise<Array>} List of templates
   */
  getDoctorTemplates: async (doctorId, activeOnly = false) => {
    try {
      const query = { doctor: doctorId };
      
      if (activeOnly) {
        query.status = 'active';
        query.effectiveUntil = { $gt: new Date() };
      }
      
      const templates = await RecurringTemplate.find(query)
        .populate('doctor', 'firstName lastName email')
        .sort('-effectiveFrom');
      
      return templates;
    } catch (error) {
      logger.error('Failed to fetch doctor templates', { 
        doctorId, 
        error: error.message 
      });
      throw new ApiError('Failed to fetch doctor templates', 500, error.message);
    }
  },
  
  /**
   * Generate time slots for a specific date based on a template
   * @param {Object} template - The recurring template
   * @param {Date} date - The date to generate slots for
   * @returns {Array} Generated time slots
   */
  generateTimeSlotsFromTemplate: (template, date) => {
    const dayOfWeek = moment(date).day();
    const daySchedule = template.weeklySchedule.find(day => day.dayOfWeek === dayOfWeek);
    
    // If no schedule defined for this day of week
    if (!daySchedule) {
      return [];
    }
    
    const timeSlots = [];
    const dateString = moment(date).format('YYYY-MM-DD');
    
    // Generate slots from working hours
    for (const hours of daySchedule.workingHours) {
      const startDateTime = moment(`${dateString}T${hours.startTime}`);
      const endDateTime = moment(`${dateString}T${hours.endTime}`);
      
      // Create a single time slot for this working period
      timeSlots.push({
        startTime: startDateTime.toDate(),
        endTime: endDateTime.toDate(),
        status: 'available',
        appointmentType: hours.appointmentTypes.length ? hours.appointmentTypes[0] : null
      });
    }
    
    // Handle breaks
    for (const breakPeriod of daySchedule.breaks) {
      const breakStart = moment(`${dateString}T${breakPeriod.startTime}`);
      const breakEnd = moment(`${dateString}T${breakPeriod.endTime}`);
      
      // Add a break slot
      timeSlots.push({
        startTime: breakStart.toDate(),
        endTime: breakEnd.toDate(),
        status: 'break',
        notes: breakPeriod.reason
      });
    }
    
    // Sort slots by start time
    return timeSlots.sort((a, b) => a.startTime - b.startTime);
  },
  
  /**
   * Generate a doctor's schedule for a specific date
   * @param {string} doctorId - The doctor's ID
   * @param {Date} date - The date to generate schedule for
   * @returns {Promise<Object>} Generated schedule
   */
  generateDailySchedule: async (doctorId, date) => {
    try {
      // Check if schedule already exists for this date
      const existingSchedule = await DoctorSchedule.findOne({
        doctor: doctorId,
        date: {
          $gte: moment(date).startOf('day').toDate(),
          $lte: moment(date).endOf('day').toDate()
        }
      });
      
      if (existingSchedule) {
        return existingSchedule;
      }
      
      // Get active template for this date
      const template = await RecurringTemplate.findOne({
        doctor: doctorId,
        status: 'active',
        effectiveFrom: { $lte: date },
        $or: [
          { effectiveUntil: null },
          { effectiveUntil: { $gte: date } }
        ]
      }).sort('-priority');
      
      if (!template) {
        logger.warn('No active template found for doctor schedule generation', { 
          doctorId, 
          date 
        });
        return null;
      }
      
      // Generate time slots based on template
      const timeSlots = scheduleService.generateTimeSlotsFromTemplate(template, date);
      
      // Create new schedule
      const schedule = new DoctorSchedule({
        doctor: doctorId,
        date: moment(date).startOf('day').toDate(),
        timeSlots,
        isWorkingDay: timeSlots.length > 0,
        generatedFrom: {
          template: template._id,
          generatedAt: new Date()
        },
        status: 'draft'
      });
      
      await schedule.save();
      
      logger.info('Generated daily schedule for doctor', {
        doctorId,
        date: schedule.date,
        slots: timeSlots.length
      });
      
      return schedule;
    } catch (error) {
      logger.error('Failed to generate daily schedule', { 
        doctorId, 
        date, 
        error: error.message 
      });
      throw new ApiError('Failed to generate daily schedule', 500, error.message);
    }
  },
  
  /**
   * Generate schedules for a date range
   * @param {string} doctorId - The doctor's ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Generated schedules
   */
  generateScheduleRange: async (doctorId, startDate, endDate) => {
    try {
      const start = moment(startDate).startOf('day');
      const end = moment(endDate).endOf('day');
      
      if (end.diff(start, 'days') > 90) {
        throw new ApiError('Cannot generate schedules for more than 90 days at once', 400);
      }
      
      const schedules = [];
      let currentDate = start.clone();
      
      while (currentDate.isSameOrBefore(end, 'day')) {
        const schedule = await scheduleService.generateDailySchedule(
          doctorId, 
          currentDate.toDate()
        );
        
        if (schedule) {
          schedules.push(schedule);
        }
        
        currentDate.add(1, 'days');
      }
      
      return schedules;
    } catch (error) {
      logger.error('Failed to generate schedule range', {
        doctorId,
        startDate,
        endDate,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Apply leave to doctor schedules
   * @param {Object} leave - The leave object
   * @returns {Promise<boolean>} Success status
   */
  applyLeaveToSchedule: async (leave) => {
    try {
      if (leave.status !== 'approved') {
        return true; // Only apply approved leave
      }
      
      const startDate = moment(leave.startDateTime).startOf('day');
      const endDate = moment(leave.endDateTime).endOf('day');
      
      // Get all schedules in this date range
      const schedules = await DoctorSchedule.find({
        doctor: leave.doctor,
        date: {
          $gte: startDate.toDate(),
          $lte: endDate.toDate()
        }
      });
      
      // For each schedule, update time slots or set isWorkingDay to false
      for (const schedule of schedules) {
        if (leave.isAllDay) {
          // Set entire day as non-working
          schedule.isWorkingDay = false;
          schedule.notes = `Leave: ${leave.leaveType} - ${leave.description}`;
          schedule.status = 'modified';
          
          // Mark all slots as leave
          schedule.timeSlots.forEach(slot => {
            slot.status = 'leave';
            slot.notes = leave.description;
          });
        } else {
          // Only mark affected time slots as leave
          schedule.timeSlots.forEach(slot => {
            const slotStart = moment(slot.startTime);
            const slotEnd = moment(slot.endTime);
            const leaveStart = moment(leave.startDateTime);
            const leaveEnd = moment(leave.endDateTime);
            
            // Check for overlap
            if (
              (slotStart.isSameOrAfter(leaveStart) && slotStart.isBefore(leaveEnd)) || 
              (slotEnd.isAfter(leaveStart) && slotEnd.isSameOrBefore(leaveEnd)) ||
              (slotStart.isBefore(leaveStart) && slotEnd.isAfter(leaveEnd))
            ) {
              slot.status = 'leave';
              slot.notes = `${leave.leaveType} leave: ${leave.description}`;
            }
          });
          
          schedule.status = 'modified';
        }
        
        await schedule.save();
      }
      
      logger.info('Applied leave to doctor schedules', {
        doctorId: leave.doctor,
        leaveId: leave._id,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD')
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to apply leave to schedule', {
        leaveId: leave._id,
        doctorId: leave.doctor,
        error: error.message
      });
      throw new ApiError('Failed to apply leave to schedule', 500, error.message);
    }
  },
  
  /**
   * Get doctor schedule for a specific day
   * @param {string} doctorId - The doctor's ID
   * @param {Date} date - The date
   * @returns {Promise<Object>} Doctor schedule
   */
  getDoctorScheduleForDay: async (doctorId, date) => {
    try {
      const startOfDay = moment(date).startOf('day').toDate();
      const endOfDay = moment(date).endOf('day').toDate();
      
      let schedule = await DoctorSchedule.findOne({
        doctor: doctorId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      }).populate({
        path: 'timeSlots.appointmentType',
        select: 'name duration bufferTime color'
      });
      
      // Auto-generate schedule if it doesn't exist
      if (!schedule) {
        schedule = await scheduleService.generateDailySchedule(doctorId, date);
        
        if (!schedule) {
          throw new ApiError('No schedule template found for this date', 404);
        }
      }
      
      return schedule;
    } catch (error) {
      logger.error('Failed to get doctor schedule for day', {
        doctorId,
        date,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Get doctor schedules by date range
   * @param {string} doctorId - The doctor's ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} List of schedules
   */
  getDoctorSchedulesByDateRange: async (doctorId, startDate, endDate) => {
    try {
      const start = moment(startDate).startOf('day').toDate();
      const end = moment(endDate).endOf('day').toDate();
      
      const schedules = await DoctorSchedule.find({
        doctor: doctorId,
        date: {
          $gte: start,
          $lte: end
        }
      }).sort('date');
      
      // Check if we have all dates in the range
      const dayCount = moment(end).diff(moment(start), 'days') + 1;
      
      if (schedules.length < dayCount) {
        // Generate missing dates
        const existingDates = schedules.map(s => moment(s.date).format('YYYY-MM-DD'));
        const allDates = [];
        
        let current = moment(start);
        while (current.isSameOrBefore(moment(end), 'day')) {
          allDates.push(current.format('YYYY-MM-DD'));
          current.add(1, 'day');
        }
        
        const missingDates = allDates.filter(date => !existingDates.includes(date));
        
        // Generate schedules for missing dates
        for (const dateStr of missingDates) {
          const newSchedule = await scheduleService.generateDailySchedule(
            doctorId, 
            moment(dateStr).toDate()
          );
          
          if (newSchedule) {
            schedules.push(newSchedule);
          }
        }
        
        // Sort schedules by date
        schedules.sort((a, b) => a.date - b.date);
      }
      
      return schedules;
    } catch (error) {
      logger.error('Failed to get doctor schedules by date range', {
        doctorId,
        startDate,
        endDate,
        error: error.message
      });
      throw new ApiError('Failed to get doctor schedules', 500, error.message);
    }
  },
  
  /**
   * Update a doctor's schedule
   * @param {string} scheduleId - The schedule ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - ID of user making the change
   * @returns {Promise<Object>} Updated schedule
   */
  updateDoctorSchedule: async (scheduleId, updateData, userId) => {
    try {
      const schedule = await DoctorSchedule.findById(scheduleId);
      
      if (!schedule) {
        throw new ApiError('Schedule not found', 404);
      }
      
      // Apply updates
      if (updateData.isWorkingDay !== undefined) {
        schedule.isWorkingDay = updateData.isWorkingDay;
      }
      
      if (updateData.notes !== undefined) {
        schedule.notes = updateData.notes;
      }
      
      if (updateData.status !== undefined) {
        schedule.status = updateData.status;
      }
      
      // Handle time slot updates
      if (updateData.timeSlots) {
        // Replace all time slots
        schedule.timeSlots = updateData.timeSlots;
      } else if (updateData.addTimeSlots) {
        // Add new time slots
        schedule.timeSlots.push(...updateData.addTimeSlots);
      } else if (updateData.updateTimeSlots) {
        // Update specific time slots
        for (const updatedSlot of updateData.updateTimeSlots) {
          const slotIndex = schedule.timeSlots.findIndex(
            slot => slot._id.toString() === updatedSlot._id
          );
          
          if (slotIndex !== -1) {
            Object.assign(schedule.timeSlots[slotIndex], updatedSlot);
          }
        }
      } else if (updateData.removeTimeSlots) {
        // Remove specific time slots
        schedule.timeSlots = schedule.timeSlots.filter(
          slot => !updateData.removeTimeSlots.includes(slot._id.toString())
        );
      }
      
      // Set last modified info
      schedule.lastModified = new Date();
      schedule.lastModifiedBy = userId;
      schedule.status = 'modified';
      
      await schedule.save();
      
      logger.info('Updated doctor schedule', {
        scheduleId,
        doctorId: schedule.doctor,
        date: schedule.date,
        userId
      });
      
      return schedule;
    } catch (error) {
      logger.error('Failed to update doctor schedule', {
        scheduleId,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Check for schedule conflicts (e.g., double booking, leaves)
   * @param {string} doctorId - The doctor's ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time 
   * @returns {Promise<Object>} Conflict check result
   */
  checkScheduleConflicts: async (doctorId, startTime, endTime) => {
    try {
      const date = moment(startTime).startOf('day').toDate();
      
      // Get schedule for this day
      const schedule = await scheduleService.getDoctorScheduleForDay(doctorId, date);
      
      if (!schedule) {
        return { hasConflict: true, reason: 'No schedule available for this date' };
      }
      
      if (!schedule.isWorkingDay) {
        return { hasConflict: true, reason: 'Not a working day' };
      }
      
      // Check if time range is within any available time slot
      const isWithinAvailableSlot = schedule.timeSlots.some(slot => {
        if (slot.status !== 'available') {
          return false;
        }
        
        const slotStart = moment(slot.startTime);
        const slotEnd = moment(slot.endTime);
        const reqStart = moment(startTime);
        const reqEnd = moment(endTime);
        
        return slotStart.isSameOrBefore(reqStart) && slotEnd.isSameOrAfter(reqEnd);
      });
      
      if (!isWithinAvailableSlot) {
        return { hasConflict: true, reason: 'Time not available in doctor schedule' };
      }
      
      // Check for approved leaves
      const leave = await Leave.findOne({
        doctor: doctorId,
        status: 'approved',
        $or: [
          { 
            startDateTime: { $lte: startTime },
            endDateTime: { $gte: startTime }
          },
          {
            startDateTime: { $lte: endTime },
            endDateTime: { $gte: endTime }
          },
          {
            startDateTime: { $gte: startTime },
            endDateTime: { $lte: endTime }
          }
        ]
      });
      
      if (leave) {
        return { 
          hasConflict: true, 
          reason: `Doctor on ${leave.leaveType} leave during this time` 
        };
      }
      
      // Check for breaks
      const breakTime = await BreakTime.findOne({
        doctor: doctorId,
        date: date,
        status: 'scheduled',
        $or: [
          { 
            startTime: { $lte: startTime },
            endTime: { $gte: startTime }
          },
          {
            startTime: { $lte: endTime },
            endTime: { $gte: endTime }
          },
          {
            startTime: { $gte: startTime },
            endTime: { $lte: endTime }
          }
        ]
      });
      
      if (breakTime) {
        return { 
          hasConflict: true, 
          reason: `Doctor on break: ${breakTime.reason}` 
        };
      }
      
      // No conflicts found
      return { hasConflict: false };
    } catch (error) {
      logger.error('Failed to check schedule conflicts', {
        doctorId,
        startTime,
        endTime,
        error: error.message
      });
      throw new ApiError('Failed to check schedule availability', 500, error.message);
    }
  }
};

module.exports = scheduleService;
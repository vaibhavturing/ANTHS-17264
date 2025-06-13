const { Doctor, Appointment, AppointmentType } = require('../models');
const { Leave } = require('../models/availability.model');
const availabilityService = require('./availability.service');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for managing doctor schedules and appointments
 */
const scheduleService = {
  /**
   * Check if a time slot is available for booking
   * @param {string} doctorId - Doctor ID
   * @param {Date} startTime - Start time of the appointment
   * @param {number} duration - Duration of the appointment in minutes
   * @param {string} appointmentTypeId - Appointment type ID
   * @param {string} excludeAppointmentId - Optional ID of appointment to exclude (for updates)
   * @returns {Promise<boolean>} Whether the time slot is available
   */
  checkTimeSlotAvailability: async (doctorId, startTime, duration = null, appointmentTypeId = null, excludeAppointmentId = null) => {
    try {
      // Find the doctor
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }

      // If appointmentTypeId is provided, get the correct duration and buffer time
      let bufferTime = 0;
      if (appointmentTypeId) {
        const appointmentType = await AppointmentType.findById(appointmentTypeId);
        if (!appointmentType) {
          throw new NotFoundError('Appointment type not found');
        }

        // Get doctor-specific settings if they exist
        const settings = appointmentType.getSettingsForDoctor(doctorId);
        duration = settings.duration;
        bufferTime = settings.bufferTime;
      }

      if (!duration) {
        throw new ValidationError('Duration is required');
      }

      // Calculate end time based on start time and duration
      const startMs = new Date(startTime).getTime();
      const durationMs = duration * 60 * 1000; // Convert minutes to milliseconds
      const endTime = new Date(startMs + durationMs);

      // NEW: Check for leave/vacation during this time
      // Convert times to HH:MM format for availability checking
      const timeSlotDate = new Date(startTime); // Date part only
      const startTimeStr = startTime.getHours().toString().padStart(2, '0') + ':' + 
                          startTime.getMinutes().toString().padStart(2, '0');
      const endTimeStr = endTime.getHours().toString().padStart(2, '0') + ':' + 
                        endTime.getMinutes().toString().padStart(2, '0');
      
      // Check doctor's availability (including leave, breaks, working hours)
      const isAvailableThroughCalendar = await availabilityService.isDoctorAvailable(
        doctorId,
        timeSlotDate,
        startTimeStr,
        endTimeStr
      );
      
      if (!isAvailableThroughCalendar) {
        return false; // Doctor is not available due to leave, break, or non-working hours
      }

      // Check for conflicting appointments
      const isAvailable = await Appointment.isTimeSlotAvailable(
        doctorId,
        startTime,
        endTime,
        excludeAppointmentId
      );

      return isAvailable;
    } catch (error) {
      logger.error('Error checking time slot availability', { 
        error: error.message,
        doctorId,
        startTime,
        duration,
        appointmentTypeId,
        excludeAppointmentId
      });
      throw error;
    }
  },

  /**
   * Find available time slots on a given day
   * @param {string} doctorId - Doctor ID
   * @param {Date} date - Day to check
   * @param {string} appointmentTypeId - Appointment type ID to check availability for
   * @returns {Promise<Array>} Array of available time slots
   */
  getAvailableTimeSlots: async (doctorId, date, appointmentTypeId) => {
    try {
      // Find the doctor
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }

      // Get the appointment type
      const appointmentType = await AppointmentType.findById(appointmentTypeId);
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }

      // Get doctor-specific settings if they exist
      const settings = appointmentType.getSettingsForDoctor(doctorId);
      const duration = settings.duration;
      const bufferTime = settings.bufferTime;
      const totalDuration = duration + bufferTime;

      // Start with the doctor's working hours for that day
      // Instead of hardcoding, fetch from availability service
      const availability = await availabilityService.getDoctorAvailability(doctorId);
      
      // Use the date to determine day of week
      const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Get working hours for this day
      const workingDay = availability.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
      
      // Check if this is a special date
      const dateStr = new Date(date).toISOString().split('T')[0];
      const specialDate = availability.specialDates.find(
        sd => new Date(sd.date).toISOString().split('T')[0] === dateStr
      );
      
      // If it's not a working day or it's a special non-working day, return empty array
      if ((specialDate && !specialDate.isWorking) || (!specialDate && (!workingDay || !workingDay.isWorking))) {
        return []; // No available slots on non-working days
      }
      
      // Set working hours based on special date or regular schedule
      let startTimeStr, endTimeStr;
      
      if (specialDate && specialDate.isWorking) {
        startTimeStr = specialDate.startTime;
        endTimeStr = specialDate.endTime;
      } else {
        startTimeStr = workingDay.startTime;
        endTimeStr = workingDay.endTime;
      }
      
      // Parse working hours into Date objects for the specified date
      const startTimeParts = startTimeStr.split(':');
      const endTimeParts = endTimeStr.split(':');
      
      const startOfDay = new Date(date);
      startOfDay.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0, 0);

      // NEW: Check if doctor is on leave for this day
      const leaves = await Leave.find({
        doctorId,
        status: 'approved',
        startDate: { $lte: new Date(date) },
        endDate: { $gte: new Date(date) }
      });
      
      // If there's an all-day leave, return empty array
      if (leaves.some(leave => leave.allDay)) {
        return []; // Doctor is on leave all day
      }

      // Get all existing appointments for this doctor on this day
      const existingAppointments = await Appointment.find({
        doctor: doctorId,
        startTime: { $gte: startOfDay, $lt: endOfDay },
        status: { $nin: ['cancelled', 'no-show'] }
      }).sort({ startTime: 1 });

      // Generate time slots for the day
      // Slot interval is based on appointment type's total duration (including buffer)
      const timeSlots = [];
      let currentTime = new Date(startOfDay);
      
      while (currentTime < endOfDay) {
        // Calculate end time of this potential appointment (without buffer)
        const appointmentEndTime = new Date(currentTime.getTime() + (duration * 60 * 1000));
        
        // If appointment would end after working hours, break the loop
        if (appointmentEndTime > endOfDay) {
          break;
        }

        // Format times for availability checking
        const slotTimeStr = currentTime.getHours().toString().padStart(2, '0') + ':' + 
                           currentTime.getMinutes().toString().padStart(2, '0');
        const slotEndTimeStr = appointmentEndTime.getHours().toString().padStart(2, '0') + ':' + 
                             appointmentEndTime.getMinutes().toString().padStart(2, '0');
                            
        // Check doctor's availability at this specific time (leaves, breaks)
        const isAvailable = await availabilityService.isDoctorAvailable(
          doctorId,
          new Date(date),
          slotTimeStr,
          slotEndTimeStr
        );
        
        // If the doctor is available according to calendar, check for appointment conflicts
        if (isAvailable) {
          // Check for conflicting appointments
          const hasNoConflict = await Appointment.isTimeSlotAvailable(
            doctorId,
            currentTime,
            appointmentEndTime
          );
          
          if (hasNoConflict) {
            timeSlots.push({
              startTime: new Date(currentTime),
              endTime: appointmentEndTime,
              duration: duration,
              bufferTime: bufferTime
            });
          }
        }
        
        // Move to the next time slot (15 min increments as standard interval)
        // In a real implementation, this could be configurable per doctor or clinic
        currentTime = new Date(currentTime.getTime() + (15 * 60 * 1000));
      }
      
      return timeSlots;
    } catch (error) {
      logger.error('Error getting available time slots', { 
        error: error.message,
        doctorId,
        date,
        appointmentTypeId
      });
      throw error;
    }
  }
};

module.exports = scheduleService;
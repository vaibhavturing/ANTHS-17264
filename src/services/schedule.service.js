const { Doctor, Appointment, AppointmentType } = require('../models');
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

      // Check if the doctor is available at that time
      // This would involve checking the doctor's schedule, off-hours, breaks, etc.
      // For this implementation, we'll just check against existing appointments

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
      // For simplicity, we'll use a static 9am-5pm schedule
      // In a real implementation, this would come from the doctor's schedule record
      const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Skip if the doctor doesn't work on this day
      // This is simplified - in a real app we'd check the doctor's actual schedule
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return []; // Doctor doesn't work on weekends in this example
      }

      // Get the doctor's schedule for this day
      const startHour = 9; // 9am
      const endHour = 17; // 5pm
      
      // Set the day's start and end times
      const startOfDay = new Date(date);
      startOfDay.setHours(startHour, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(endHour, 0, 0, 0);

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

        // Check if this time slot conflicts with any existing appointments
        const slotAvailable = await scheduleService.checkTimeSlotAvailability(
          doctorId, 
          currentTime, 
          duration,
          appointmentTypeId
        );
        
        if (slotAvailable) {
          timeSlots.push({
            startTime: new Date(currentTime),
            endTime: appointmentEndTime,
            duration: duration,
            bufferTime: bufferTime
          });
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
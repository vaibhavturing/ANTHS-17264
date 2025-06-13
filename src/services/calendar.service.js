const { Appointment } = require('../models/appointment.model');
const AppointmentType = require('../models/appointmentType.model');
const User = require('../models/user.model');
const availabilityService = require('./availability.service');
const holidayService = require('./holiday.service');
const logger = require('../utils/logger');
const { NotFoundError } = require('../utils/errors');
const moment = require('moment');

/**
 * Service for calendar functionality in the Healthcare Management Application
 */
const calendarService = {
  /**
   * Get calendar data for a specific doctor
   * @param {string} doctorId - Doctor ID
   * @param {Object} options - Calendar options
   * @returns {Promise<Object>} Calendar data
   */
  getDoctorCalendar: async (doctorId, options = {}) => {
    try {
      const {
        view = 'month',  // 'day', 'week', or 'month'
        date = new Date(),
        includeAvailability = true,
        includeHolidays = true,
        includeBlockedTime = true,
      } = options;
      
      logger.info('Fetching calendar data for doctor', { 
        doctorId,
        view,
        date
      });
      
      // Validate the doctor exists
      const doctor = await User.findById(doctorId).lean();
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Calculate date range based on view
      const { startDate, endDate } = calendarService._calculateDateRange(date, view);
      
      // Get all appointment types for color mapping
      const appointmentTypes = await AppointmentType.find({ isActive: true }).lean();
      
      // Get all appointments in the date range for this doctor
      const appointments = await calendarService.getAppointmentsInRange(
        doctorId,
        startDate,
        endDate
      );
      
      // Get availability slots if requested
      let availabilitySlots = [];
      if (includeAvailability) {
        availabilitySlots = await availabilityService.getDoctorAvailabilityInRange(
          doctorId,
          startDate, 
          endDate
        );
      }
      
      // Get holidays if requested
      let holidays = [];
      if (includeHolidays) {
        holidays = await holidayService.getHolidaysInRange(startDate, endDate);
      }
      
      // Get blocked time (leave, vacation, etc.) if requested
      let blockedTimes = [];
      if (includeBlockedTime) {
        blockedTimes = await availabilityService.getDoctorBlockedTimeInRange(
          doctorId,
          startDate,
          endDate
        );
      }
      
      // Format data for calendar display
      const calendarData = await calendarService._formatCalendarData({
        appointments,
        appointmentTypes,
        availabilitySlots,
        holidays,
        blockedTimes,
        view,
        startDate,
        endDate
      });
      
      // Check for scheduling conflicts and mark them
      const conflictCheck = calendarService._detectCalendarConflicts(calendarData.events);
      calendarData.events = conflictCheck.events;
      calendarData.hasConflicts = conflictCheck.hasConflicts;
      
      logger.info('Successfully fetched calendar data', { 
        doctorId,
        view,
        eventsCount: calendarData.events.length,
        hasConflicts: calendarData.hasConflicts
      });
      
      return calendarData;
    } catch (error) {
      logger.error('Failed to fetch calendar data', { 
        error: error.message,
        doctorId
      });
      throw error;
    }
  },
  
  /**
   * Get appointments in a date range for a specific doctor
   * @param {string} doctorId - Doctor ID
   * @param {Date} startDate - Range start
   * @param {Date} endDate - Range end
   * @returns {Promise<Array>} List of appointments
   */
  getAppointmentsInRange: async (doctorId, startDate, endDate) => {
    try {
      const appointments = await Appointment.find({
        doctor: doctorId,
        startTime: { $gte: startDate, $lte: endDate },
        status: { $nin: ['cancelled', 'no-show'] }
      })
      .populate('patient', 'firstName lastName email')
      .populate('appointmentType')
      .populate({
        path: 'recurringSeriesId',
        select: 'frequency occurrences'
      })
      .lean();
      
      return appointments;
    } catch (error) {
      logger.error('Failed to fetch appointments in range', { 
        error: error.message,
        doctorId,
        startDate,
        endDate
      });
      throw error;
    }
  },
  
  /**
   * Get calendar events for admin dashboard (multiple doctors)
   * @param {Object} options - Calendar options
   * @returns {Promise<Object>} Calendar data for admin dashboard
   */
  getAdminCalendar: async (options = {}) => {
    try {
      const {
        view = 'day',  // 'day', 'week', or 'month'
        date = new Date(),
        doctorIds = [],
        departmentId = null,
        includeAvailability = true,
        includeHolidays = true,
        includeBlockedTime = true,
      } = options;
      
      logger.info('Fetching calendar data for admin dashboard', { 
        view,
        date,
        doctorCount: doctorIds.length,
        departmentId
      });
      
      // Calculate date range based on view
      const { startDate, endDate } = calendarService._calculateDateRange(date, view);
      
      // Get doctors to include in the calendar
      let doctors = [];
      if (doctorIds && doctorIds.length > 0) {
        // Get specific doctors
        doctors = await User.find({
          _id: { $in: doctorIds },
          role: 'doctor',
          isActive: true
        }).select('firstName lastName email').lean();
      } else if (departmentId) {
        // Get all doctors in a department
        doctors = await User.find({
          departments: departmentId,
          role: 'doctor',
          isActive: true
        }).select('firstName lastName email').lean();
      } else {
        // Get all doctors
        doctors = await User.find({
          role: 'doctor',
          isActive: true
        }).select('firstName lastName email').lean();
      }
      
      // Get all appointment types for color mapping
      const appointmentTypes = await AppointmentType.find({ isActive: true }).lean();
      
      // Get all appointments for all doctors
      const appointments = await Appointment.find({
        doctor: { $in: doctors.map(d => d._id) },
        startTime: { $gte: startDate, $lte: endDate },
        status: { $nin: ['cancelled', 'no-show'] }
      })
      .populate('patient', 'firstName lastName email')
      .populate('doctor', 'firstName lastName email')
      .populate('appointmentType')
      .lean();
      
      // Get holidays if requested
      let holidays = [];
      if (includeHolidays) {
        holidays = await holidayService.getHolidaysInRange(startDate, endDate);
      }
      
      // Prepare combined calendar data
      const calendarData = {
        view,
        date,
        startDate,
        endDate,
        doctors,
        events: [],
        hasConflicts: false
      };
      
      // Format appointments for calendar
      appointments.forEach(appointment => {
        // Find the appointment type color
        const appointmentType = appointmentTypes.find(
          type => type._id.toString() === appointment.appointmentType._id.toString()
        ) || { color: '#3498db' }; // Default blue if type not found
        
        const doctorName = appointment.doctor ? 
          `${appointment.doctor.firstName} ${appointment.doctor.lastName}` : 
          'Unknown Doctor';
          
        const patientName = appointment.patient ? 
          `${appointment.patient.firstName} ${appointment.patient.lastName}` : 
          'Unknown Patient';
        
        calendarData.events.push({
          id: appointment._id.toString(),
          title: `${patientName} - ${appointment.appointmentType.name}`,
          start: appointment.startTime,
          end: appointment.endTime,
          color: appointmentType.color,
          textColor: '#ffffff',
          doctorId: appointment.doctor._id.toString(),
          doctorName,
          patientId: appointment.patient._id.toString(),
          patientName,
          appointmentTypeId: appointment.appointmentType._id.toString(),
          appointmentTypeName: appointment.appointmentType.name,
          status: appointment.status,
          isRecurring: appointment.isPartOfSeries || false,
          type: 'appointment'
        });
      });
      
      // Add holidays as non-interactive events
      if (holidays.length > 0) {
        holidays.forEach(holiday => {
          const holidayDate = new Date(holiday.date);
          
          calendarData.events.push({
            id: `holiday-${holidayDate.toISOString().split('T')[0]}`,
            title: holiday.name,
            start: holidayDate,
            end: holidayDate, // Full day event
            allDay: true,
            color: '#e74c3c', // Red color for holidays
            textColor: '#ffffff',
            type: 'holiday',
            rendering: 'background',
            editable: false
          });
        });
      }
      
      // Add individual doctor availability and blocked time if requested
      if (includeAvailability || includeBlockedTime) {
        for (const doctor of doctors) {
          if (includeAvailability) {
            const availabilitySlots = await availabilityService.getDoctorAvailabilityInRange(
              doctor._id,
              startDate, 
              endDate
            );
            
            availabilitySlots.forEach(slot => {
              calendarData.events.push({
                id: `avail-${doctor._id}-${slot.startTime.toISOString()}`,
                title: `${doctor.firstName} ${doctor.lastName} - Available`,
                start: slot.startTime,
                end: slot.endTime,
                color: '#2ecc71', // Green for availability
                textColor: '#ffffff',
                doctorId: doctor._id.toString(),
                doctorName: `${doctor.firstName} ${doctor.lastName}`,
                type: 'availability',
                rendering: 'background',
                editable: false
              });
            });
          }
          
          if (includeBlockedTime) {
            const blockedTimes = await availabilityService.getDoctorBlockedTimeInRange(
              doctor._id,
              startDate,
              endDate
            );
            
            blockedTimes.forEach(block => {
              calendarData.events.push({
                id: `block-${doctor._id}-${block.startTime.toISOString()}`,
                title: `${doctor.firstName} ${doctor.lastName} - ${block.reason || 'Unavailable'}`,
                start: block.startTime,
                end: block.endTime,
                color: '#7f8c8d', // Gray for blocked time
                textColor: '#ffffff',
                doctorId: doctor._id.toString(),
                doctorName: `${doctor.firstName} ${doctor.lastName}`,
                reason: block.reason,
                type: 'blocked',
                rendering: 'background',
                editable: false
              });
            });
          }
        }
      }
      
      // Check for conflicts
      const conflictCheck = calendarService._detectCalendarConflicts(calendarData.events);
      calendarData.events = conflictCheck.events;
      calendarData.hasConflicts = conflictCheck.hasConflicts;
      
      logger.info('Successfully fetched admin calendar data', { 
        doctorCount: doctors.length,
        eventsCount: calendarData.events.length,
        hasConflicts: calendarData.hasConflicts
      });
      
      return calendarData;
    } catch (error) {
      logger.error('Failed to fetch admin calendar data', { 
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Calculate start and end dates for a calendar view
   * @private
   * @param {Date} date - Base date
   * @param {string} view - Calendar view ('day', 'week', 'month')
   * @returns {Object} Start and end dates
   */
  _calculateDateRange: (date, view) => {
    const baseDate = moment(date);
    let startDate, endDate;
    
    switch (view) {
      case 'day':
        startDate = moment(baseDate).startOf('day').toDate();
        endDate = moment(baseDate).endOf('day').toDate();
        break;
      case 'week':
        startDate = moment(baseDate).startOf('week').toDate();
        endDate = moment(baseDate).endOf('week').toDate();
        break;
      case 'month':
      default:
        startDate = moment(baseDate).startOf('month').startOf('week').toDate();
        endDate = moment(baseDate).endOf('month').endOf('week').toDate();
        break;
    }
    
    return { startDate, endDate };
  },
  
  /**
   * Format raw data into calendar-friendly format
   * @private
   * @param {Object} data - Calendar source data
   * @returns {Promise<Object>} Formatted calendar data
   */
  _formatCalendarData: async (data) => {
    const {
      appointments,
      appointmentTypes,
      availabilitySlots,
      holidays,
      blockedTimes,
      view,
      startDate,
      endDate
    } = data;
    
    // Initialize calendar data structure
    const calendarData = {
      view,
      date: moment(startDate).add(1, 'day').toDate(), // Center date of the view
      startDate,
      endDate,
      events: []
    };
    
    // Format appointments
    appointments.forEach(appointment => {
      // Find the appointment type color
      const appointmentType = appointmentTypes.find(
        type => type._id.toString() === appointment.appointmentType._id.toString()
      ) || { color: '#3498db' }; // Default blue if type not found
      
      const patientName = appointment.patient ? 
        `${appointment.patient.firstName} ${appointment.patient.lastName}` : 
        'Unknown Patient';
      
      calendarData.events.push({
        id: appointment._id.toString(),
        title: `${patientName} - ${appointment.appointmentType.name}`,
        start: appointment.startTime,
        end: appointment.endTime,
        color: appointmentType.color,
        textColor: '#ffffff',
        patientId: appointment.patient._id.toString(),
        patientName,
        appointmentTypeId: appointment.appointmentType._id.toString(),
        appointmentTypeName: appointment.appointmentType.name,
        status: appointment.status,
        isRecurring: appointment.isPartOfSeries || false,
        isModified: appointment.isModifiedOccurrence || false,
        type: 'appointment'
      });
    });
    
    // Add availability slots
    if (availabilitySlots && availabilitySlots.length > 0) {
      availabilitySlots.forEach(slot => {
        calendarData.events.push({
          id: `avail-${slot._id || slot.startTime.toISOString()}`,
          title: 'Available',
          start: slot.startTime,
          end: slot.endTime,
          color: '#2ecc71', // Green for availability
          rendering: 'background',
          type: 'availability',
          editable: false
        });
      });
    }
    
    // Add holidays
    if (holidays && holidays.length > 0) {
      holidays.forEach(holiday => {
        const holidayDate = new Date(holiday.date);
        
        calendarData.events.push({
          id: `holiday-${holidayDate.toISOString().split('T')[0]}`,
          title: holiday.name,
          start: holidayDate,
          end: holidayDate, // Full day event
          allDay: true,
          color: '#e74c3c', // Red color for holidays
          textColor: '#ffffff',
          type: 'holiday',
          rendering: 'background',
          editable: false
        });
      });
    }
    
    // Add blocked time (leave, vacation, etc.)
    if (blockedTimes && blockedTimes.length > 0) {
      blockedTimes.forEach(block => {
        calendarData.events.push({
          id: `block-${block._id || block.startTime.toISOString()}`,
          title: block.reason || 'Unavailable',
          start: block.startTime,
          end: block.endTime,
          color: '#7f8c8d', // Gray for blocked time
          textColor: '#ffffff',
          reason: block.reason,
          type: 'blocked',
          rendering: 'background',
          editable: false
        });
      });
    }
    
    return calendarData;
  },
  
  /**
   * Detect and mark scheduling conflicts in calendar events
   * @private
   * @param {Array} events - Calendar events
   * @returns {Object} Events with conflicts marked and conflict status
   */
  _detectCalendarConflicts: (events) => {
    let hasConflicts = false;
    const appointmentEvents = events.filter(e => e.type === 'appointment');
    
    // Group appointments by doctor to check conflicts
    const appointmentsByDoctor = {};
    
    // Initialize groups
    appointmentEvents.forEach(event => {
      const doctorId = event.doctorId;
      if (!appointmentsByDoctor[doctorId]) {
        appointmentsByDoctor[doctorId] = [];
      }
      appointmentsByDoctor[doctorId].push(event);
    });
    
    // Check for conflicts within each doctor's appointments
    Object.keys(appointmentsByDoctor).forEach(doctorId => {
      const doctorAppointments = appointmentsByDoctor[doctorId];
      
      for (let i = 0; i < doctorAppointments.length; i++) {
        for (let j = i + 1; j < doctorAppointments.length; j++) {
          const appt1 = doctorAppointments[i];
          const appt2 = doctorAppointments[j];
          
          // Check for time overlap
          const start1 = new Date(appt1.start).getTime();
          const end1 = new Date(appt1.end).getTime();
          const start2 = new Date(appt2.start).getTime();
          const end2 = new Date(appt2.end).getTime();
          
          const isOverlap = (start1 < end2 && start1 >= start2) ||
                           (end1 > start2 && end1 <= end2) ||
                           (start1 <= start2 && end1 >= end2);
          
          if (isOverlap) {
            // Mark both events as conflicting
            appt1.hasConflict = true;
            appt2.hasConflict = true;
            
            // Add a bright border to highlight the conflict
            appt1.borderColor = '#ff0000'; // Red border
            appt2.borderColor = '#ff0000';
            
            hasConflicts = true;
          }
        }
      }
    });
    
    // Also check for appointments scheduled during blocked time
    const blockedTimeEvents = events.filter(e => e.type === 'blocked');
    
    appointmentEvents.forEach(appointment => {
      const appStart = new Date(appointment.start).getTime();
      const appEnd = new Date(appointment.end).getTime();
      
      blockedTimeEvents.forEach(blockedTime => {
        if (appointment.doctorId === blockedTime.doctorId) {
          const blockStart = new Date(blockedTime.start).getTime();
          const blockEnd = new Date(blockedTime.end).getTime();
          
          const isOverlap = (appStart < blockEnd && appStart >= blockStart) ||
                           (appEnd > blockStart && appEnd <= blockEnd) ||
                           (appStart <= blockStart && appEnd >= blockEnd);
          
          if (isOverlap) {
            // Mark appointment as conflicting with blocked time
            appointment.hasConflict = true;
            appointment.conflictType = 'blocked';
            appointment.borderColor = '#ff0000'; // Red border
            
            hasConflicts = true;
          }
        }
      });
    });
    
    return {
      events,
      hasConflicts
    };
  }
};

module.exports = calendarService;

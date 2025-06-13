const { Availability, Leave, BreakTime } = require('../models/availability.model');
const Appointment = require('../models/appointment.model');
const Doctor = require('../models/doctor.model');
const User = require('../models/user.model');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for managing doctor availability
 */
const availabilityService = {


  /**
 * Get doctor's availability in a date range
 * @param {string} doctorId - Doctor ID
 * @param {Date} startDate - Range start date
 * @param {Date} endDate - Range end date
 * @returns {Promise<Array>} List of availability slots
 */
getDoctorAvailabilityInRange: async (doctorId, startDate, endDate) => {
  try {
    logger.info('Getting doctor availability in date range', { 
      doctorId, 
      startDate, 
      endDate 
    });
    
    const availabilitySlots = [];
    
    // Convert to moment objects for easier date manipulation
    const start = moment(startDate);
    const end = moment(endDate);
    
    // Iterate through days in the range
    const currentDay = moment(start);
    while (currentDay.isSameOrBefore(end, 'day')) {
      const dailyAvailability = await availabilityService.getDoctorDailyAvailability(
        doctorId,
        currentDay.toDate()
      );
      
      if (dailyAvailability && dailyAvailability.timeSlots) {
        // Add the day's time slots to the result
        availabilitySlots.push(...dailyAvailability.timeSlots);
      }
      
      // Move to next day
      currentDay.add(1, 'day');
    }
    
    logger.info('Successfully got doctor availability in range', { 
      doctorId, 
      slotsCount: availabilitySlots.length 
    });
    
    return availabilitySlots;
  } catch (error) {
    logger.error('Failed to get doctor availability in range', { 
      error: error.message,
      doctorId,
      startDate,
      endDate
    });
    
    throw error;
  }
},

/**
 * Get doctor's blocked time (leave, vacation, etc.) in a date range
 * @param {string} doctorId - Doctor ID
 * @param {Date} startDate - Range start date
 * @param {Date} endDate - Range end date
 * @returns {Promise<Array>} List of blocked time periods
 */
getDoctorBlockedTimeInRange: async (doctorId, startDate, endDate) => {
  try {
    logger.info('Getting doctor blocked time in date range', { 
      doctorId, 
      startDate, 
      endDate 
    });
    
    // Query the database for leave periods that overlap with the date range
    const blockedPeriods = await Leave.find({
      doctor: doctorId,
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } }
      ]
    }).lean();
    
    // Format the blocked periods for calendar display
    const formattedPeriods = blockedPeriods.map(period => ({
      startTime: period.startDate,
      endTime: period.endDate,
      reason: period.reason,
      type: period.type || 'leave'
    }));
    
    logger.info('Successfully got doctor blocked time in range', { 
      doctorId, 
      periodsCount: formattedPeriods.length 
    });
    
    return formattedPeriods;
  } catch (error) {
    logger.error('Failed to get doctor blocked time in range', { 
      error: error.message,
      doctorId,
      startDate,
      endDate
    });
    
    throw error;
  }
},


  /**
   * Get doctor availability
   * @param {string} doctorId - Doctor ID
   * @returns {Promise<Object>} Availability record
   */
  getDoctorAvailability: async (doctorId) => {
    try {
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Get or create availability record
      let availability = await Availability.findOne({ doctorId });
      
      if (!availability) {
        // Create default availability with standard work hours (9am-5pm, Monday to Friday)
        availability = new Availability({
          doctorId,
          workingHours: [
            { dayOfWeek: 0, isWorking: false }, // Sunday
            { dayOfWeek: 1, isWorking: true, startTime: '09:00', endTime: '17:00' }, // Monday
            { dayOfWeek: 2, isWorking: true, startTime: '09:00', endTime: '17:00' }, // Tuesday
            { dayOfWeek: 3, isWorking: true, startTime: '09:00', endTime: '17:00' }, // Wednesday
            { dayOfWeek: 4, isWorking: true, startTime: '09:00', endTime: '17:00' }, // Thursday
            { dayOfWeek: 5, isWorking: true, startTime: '09:00', endTime: '17:00' }, // Friday
            { dayOfWeek: 6, isWorking: false } // Saturday
          ],
          specialDates: []
        });
        
        await availability.save();
      }
      
      return availability;
    } catch (error) {
      logger.error('Error getting doctor availability', { 
        error: error.message,
        doctorId 
      });
      throw error;
    }
  },

  /**
   * Update doctor working hours
   * @param {string} doctorId - Doctor ID
   * @param {Array} workingHours - Working hours array
   * @returns {Promise<Object>} Updated availability
   */
  updateWorkingHours: async (doctorId, workingHours) => {
    try {
      const availability = await availabilityService.getDoctorAvailability(doctorId);
      
      // Validate working hours
      if (!Array.isArray(workingHours) || workingHours.length !== 7) {
        throw new ValidationError('Working hours must include all 7 days of the week');
      }
      
      // Sort by day of week to ensure correct order
      workingHours.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
      
      // Verify each day is represented exactly once
      const days = workingHours.map(wh => wh.dayOfWeek);
      if (new Set(days).size !== 7 || !days.every(d => d >= 0 && d <= 6)) {
        throw new ValidationError('Working hours must include each day exactly once (0-6)');
      }
      
      // Update working hours
      availability.workingHours = workingHours;
      await availability.save();
      
      logger.info('Updated working hours for doctor', { doctorId });
      return availability;
    } catch (error) {
      logger.error('Error updating working hours', { 
        error: error.message,
        doctorId 
      });
      throw error;
    }
  },

  /**
   * Add or update a special date
   * @param {string} doctorId - Doctor ID
   * @param {Object} specialDate - Special date object
   * @returns {Promise<Object>} Updated availability
   */
  addSpecialDate: async (doctorId, specialDate) => {
    try {
      const availability = await availabilityService.getDoctorAvailability(doctorId);
      
      // Check if this date already exists
      const dateStr = new Date(specialDate.date).toISOString().split('T')[0];
      const existingIndex = availability.specialDates.findIndex(
        sd => new Date(sd.date).toISOString().split('T')[0] === dateStr
      );
      
      if (existingIndex >= 0) {
        // Update existing special date
        availability.specialDates[existingIndex] = {
          ...availability.specialDates[existingIndex].toObject(),
          ...specialDate
        };
      } else {
        // Add new special date
        availability.specialDates.push(specialDate);
      }
      
      await availability.save();
      
      logger.info('Added/updated special date for doctor', { doctorId, date: dateStr });
      return availability;
    } catch (error) {
      logger.error('Error adding special date', { 
        error: error.message,
        doctorId,
        specialDate 
      });
      throw error;
    }
  },

  /**
   * Remove a special date
   * @param {string} doctorId - Doctor ID
   * @param {string} specialDateId - Special date ID
   * @returns {Promise<Object>} Updated availability
   */
  removeSpecialDate: async (doctorId, specialDateId) => {
    try {
      const availability = await availabilityService.getDoctorAvailability(doctorId);
      
      // Filter out the special date
      availability.specialDates = availability.specialDates.filter(
        sd => sd._id.toString() !== specialDateId
      );
      
      await availability.save();
      
      logger.info('Removed special date for doctor', { doctorId, specialDateId });
      return availability;
    } catch (error) {
      logger.error('Error removing special date', { 
        error: error.message,
        doctorId,
        specialDateId 
      });
      throw error;
    }
  },

  /**
   * Create a leave request
   * @param {Object} leaveData - Leave data
   * @returns {Promise<Object>} Created leave
   */
  createLeave: async (leaveData) => {
    try {
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: leaveData.doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Create leave
      const leave = new Leave(leaveData);
      
      // Set initial status
      // If user requesting is an admin, auto-approve
      if (leaveData.requestedBy && leaveData.autoApprove) {
        leave.status = 'approved';
        leave.approvedBy = leaveData.requestedBy;
        leave.statusUpdatedAt = new Date();
      }
      
      await leave.save();
      
      // If leave is approved, process affected appointments
      if (leave.status === 'approved') {
        // This will be run asynchronously to avoid blocking the response
        availabilityService._processAffectedAppointments(leave._id)
          .catch(err => logger.error('Error processing affected appointments', { 
            error: err.message, 
            leaveId: leave._id 
          }));
      }
      
      logger.info('Created leave request', { leaveId: leave._id, doctorId: leave.doctorId });
      return leave;
    } catch (error) {
      logger.error('Error creating leave', { 
        error: error.message,
        leaveData 
      });
      throw error;
    }
  },

  /**
   * Get all leaves for a doctor
   * @param {string} doctorId - Doctor ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of leaves
   */
  getDoctorLeaves: async (doctorId, filters = {}) => {
    try {
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Build query
      const query = { doctorId };
      
      // Apply status filter
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Apply date range filter
      if (filters.startDate) {
        query.endDate = { $gte: new Date(filters.startDate) };
      }
      
      if (filters.endDate) {
        query.startDate = { $lte: new Date(filters.endDate) };
      }
      
      // Get leaves
      const leaves = await Leave.find(query)
        .sort({ startDate: 1 })
        .populate('approvedBy', 'firstName lastName email');
      
      return leaves;
    } catch (error) {
      logger.error('Error getting doctor leaves', { 
        error: error.message,
        doctorId,
        filters 
      });
      throw error;
    }
  },

  /**
   * Get leave by ID
   * @param {string} leaveId - Leave ID
   * @returns {Promise<Object>} Leave object
   */
  getLeaveById: async (leaveId) => {
    try {
      const leave = await Leave.findById(leaveId)
        .populate('approvedBy', 'firstName lastName email');
      
      if (!leave) {
        throw new NotFoundError('Leave not found');
      }
      
      return leave;
    } catch (error) {
      logger.error('Error getting leave', { 
        error: error.message,
        leaveId 
      });
      throw error;
    }
  },

  /**
   * Update leave request
   * @param {string} leaveId - Leave ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated leave
   */
  updateLeave: async (leaveId, updates) => {
    try {
      const leave = await Leave.findById(leaveId);
      
      if (!leave) {
        throw new NotFoundError('Leave not found');
      }
      
      // Check if status is being changed to approved
      const isNewlyApproved = updates.status === 'approved' && leave.status !== 'approved';
      
      // Apply updates
      Object.keys(updates).forEach(key => {
        leave[key] = updates[key];
      });
      
      // If status is changing, record the time
      if (updates.status && updates.status !== leave.status) {
        leave.statusUpdatedAt = new Date();
      }
      
      await leave.save();
      
      // If leave is newly approved, process affected appointments
      if (isNewlyApproved) {
        // This will be run asynchronously to avoid blocking the response
        availabilityService._processAffectedAppointments(leave._id)
          .catch(err => logger.error('Error processing affected appointments', { 
            error: err.message, 
            leaveId: leave._id 
          }));
      }
      
      logger.info('Updated leave', { leaveId });
      return leave;
    } catch (error) {
      logger.error('Error updating leave', { 
        error: error.message,
        leaveId,
        updates 
      });
      throw error;
    }
  },

  /**
   * Delete leave request
   * @param {string} leaveId - Leave ID
   * @returns {Promise<Object>} Deletion result
   */
  deleteLeave: async (leaveId) => {
    try {
      const leave = await Leave.findById(leaveId);
      
      if (!leave) {
        throw new NotFoundError('Leave not found');
      }
      
      // Only allow deletion of pending or cancelled leaves
      if (leave.status !== 'pending' && leave.status !== 'cancelled') {
        throw new ValidationError('Cannot delete approved or rejected leave');
      }
      
      const result = await Leave.deleteOne({ _id: leaveId });
      
      logger.info('Deleted leave', { leaveId });
      return { success: true, message: 'Leave deleted successfully' };
    } catch (error) {
      logger.error('Error deleting leave', { 
        error: error.message,
        leaveId 
      });
      throw error;
    }
  },
  
  /**
   * Process appointments affected by a leave
   * @param {string} leaveId - Leave ID
   * @returns {Promise<Object>} Result with affected appointments
   * @private - Intended for internal use only
   */
  _processAffectedAppointments: async (leaveId) => {
    try {
      const leave = await Leave.findById(leaveId);
      
      if (!leave) {
        throw new NotFoundError('Leave not found');
      }
      
      // Only process approved leaves
      if (leave.status !== 'approved') {
        return { success: true, message: 'Leave is not approved, no appointments to process' };
      }
      
      // Check if already processed
      if (leave.affectedAppointmentsProcessed) {
        return { success: true, message: 'Affected appointments already processed' };
      }
      
      // Get doctor details for notifications
      const doctor = await Doctor.findById(leave.doctorId)
        .populate('user', 'firstName lastName email');
      
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Find all appointments during the leave period
      const query = {
        doctor: leave.doctorId,
        status: { $nin: ['cancelled', 'completed'] },
        startTime: { $gte: leave.startDate },
        endTime: { $lte: leave.endDate }
      };
      
      // For partial day leave, filter by time as well
      if (!leave.allDay) {
        // Convert leave times to milliseconds since midnight for comparison
        const leaveStartParts = leave.startTime.split(':');
        const leaveEndParts = leave.endTime.split(':');
        
        const leaveStartMs = (parseInt(leaveStartParts[0]) * 60 + parseInt(leaveStartParts[1])) * 60 * 1000;
        const leaveEndMs = (parseInt(leaveEndParts[0]) * 60 + parseInt(leaveEndParts[1])) * 60 * 1000;
        
        // Adjust the query to check for time overlap
        // This is a bit complex as we need to extract time from the datetime
        query['$expr'] = {
          $and: [
            {
              $lt: [
                {
                  $add: [
                    { $multiply: [{ $hour: '$startTime' }, 60, 60, 1000] },
                    { $multiply: [{ $minute: '$startTime' }, 60, 1000] }
                  ]
                },
                leaveEndMs
              ]
            },
            {
              $gt: [
                {
                  $add: [
                    { $multiply: [{ $hour: '$endTime' }, 60, 60, 1000] },
                    { $multiply: [{ $minute: '$endTime' }, 60, 1000] }
                  ]
                },
                leaveStartMs
              ]
            }
          ]
        };
      }
      
      const affectedAppointments = await Appointment.find(query)
        .populate('patient', 'firstName lastName email phone')
        .populate('appointmentType', 'name');
      
      // If no affected appointments, mark as processed and return
      if (affectedAppointments.length === 0) {
        leave.affectedAppointmentsProcessed = true;
        await leave.save();
        
        return { success: true, message: 'No appointments affected by this leave' };
      }
      
      // Create notification for staff
      const notificationData = {
        type: 'doctor_leave',
        title: `Doctor Leave: ${doctor.user.firstName} ${doctor.user.lastName}`,
        message: `${doctor.user.firstName} ${doctor.user.lastName} will be on leave from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()}. ${affectedAppointments.length} appointment(s) need to be rescheduled.`,
        data: {
          leaveId: leave._id,
          doctorId: leave.doctorId,
          doctorName: `${doctor.user.firstName} ${doctor.user.lastName}`,
          startDate: leave.startDate,
          endDate: leave.endDate,
          leaveType: leave.type,
          affectedAppointmentsCount: affectedAppointments.length,
          affectedAppointments: affectedAppointments.map(apt => ({
            id: apt._id,
            patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
            patientEmail: apt.patient.email,
            patientPhone: apt.patient.phone,
            appointmentType: apt.appointmentType.name,
            startTime: apt.startTime,
            endTime: apt.endTime
          }))
        },
        priority: 'high',
        recipients: {
          roles: ['admin', 'receptionist'],
          userIds: []
        },
        read: [],
        actions: [
          {
            name: 'View Leave',
            link: `/admin/leave/${leave._id}`
          },
          {
            name: 'Manage Appointments',
            link: `/admin/appointments/affected-by-leave/${leave._id}`
          }
        ]
      };
      
      const notification = await notificationService.createNotification(notificationData);
      
      // Update the leave with notification ID and mark as processed
      leave.notificationId = notification._id;
      leave.affectedAppointmentsProcessed = true;
      await leave.save();
      
      // Optional: Send email to staff about affected appointments
      try {
        await emailService.sendStaffNotificationEmail(
          'leave_affected_appointments',
          'Appointments Affected by Doctor Leave',
          notificationData
        );
      } catch (emailError) {
        logger.error('Error sending staff notification email', {
          error: emailError.message,
          leaveId,
          notificationId: notification._id
        });
        // Don't throw here, as the main functionality has succeeded
      }
      
      return { 
        success: true,
        message: `Processed ${affectedAppointments.length} affected appointments`,
        affectedAppointments: affectedAppointments.length,
        notificationId: notification._id
      };
    } catch (error) {
      logger.error('Error processing affected appointments', { 
        error: error.message,
        leaveId 
      });
      throw error;
    }
  },

  /**
   * Create a break time
   * @param {Object} breakData - Break time data
   * @returns {Promise<Object>} Created break time
   */
  createBreakTime: async (breakData) => {
    try {
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: breakData.doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Create break time
      const breakTime = new BreakTime(breakData);
      await breakTime.save();
      
      logger.info('Created break time', { 
        breakTimeId: breakTime._id,
        doctorId: breakTime.doctorId,
        dayOfWeek: breakTime.dayOfWeek
      });
      
      return breakTime;
    } catch (error) {
      logger.error('Error creating break time', { 
        error: error.message,
        breakData 
      });
      throw error;
    }
  },

  /**
   * Get all break times for a doctor
   * @param {string} doctorId - Doctor ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of break times
   */
  getDoctorBreakTimes: async (doctorId, filters = {}) => {
    try {
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Build query
      const query = { doctorId };
      
      // Apply active filter
      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }
      
      // Apply day of week filter
      if (filters.dayOfWeek !== undefined) {
        query.dayOfWeek = filters.dayOfWeek;
      }
      
      // Apply effective date filter if provided
      if (filters.effectiveDate) {
        const effectiveDate = new Date(filters.effectiveDate);
        query.$or = [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: effectiveDate } }
        ];
        query.$or.push(
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: effectiveDate } }
        );
      }
      
      // Get break times
      const breakTimes = await BreakTime.find(query).sort({ dayOfWeek: 1, startTime: 1 });
      
      return breakTimes;
    } catch (error) {
      logger.error('Error getting doctor break times', { 
        error: error.message,
        doctorId,
        filters 
      });
      throw error;
    }
  },

  /**
   * Update break time
   * @param {string} breakTimeId - Break time ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated break time
   */
  updateBreakTime: async (breakTimeId, updates) => {
    try {
      const breakTime = await BreakTime.findById(breakTimeId);
      
      if (!breakTime) {
        throw new NotFoundError('Break time not found');
      }
      
      // Apply updates
      Object.keys(updates).forEach(key => {
        breakTime[key] = updates[key];
      });
      
      await breakTime.save();
      
      logger.info('Updated break time', { breakTimeId });
      return breakTime;
    } catch (error) {
      logger.error('Error updating break time', { 
        error: error.message,
        breakTimeId,
        updates 
      });
      throw error;
    }
  },

  /**
   * Delete break time
   * @param {string} breakTimeId - Break time ID
   * @returns {Promise<Object>} Deletion result
   */
  deleteBreakTime: async (breakTimeId) => {
    try {
      const breakTime = await BreakTime.findById(breakTimeId);
      
      if (!breakTime) {
        throw new NotFoundError('Break time not found');
      }
      
      const result = await BreakTime.deleteOne({ _id: breakTimeId });
      
      logger.info('Deleted break time', { breakTimeId });
      return { success: true, message: 'Break time deleted successfully' };
    } catch (error) {
      logger.error('Error deleting break time', { 
        error: error.message,
        breakTimeId 
      });
      throw error;
    }
  },

  /**
   * Check if a doctor is available on a specific date
   * @param {string} doctorId - Doctor ID
   * @param {Date} date - Date to check
   * @param {string} startTime - Start time (format: HH:MM)
   * @param {string} endTime - End time (format: HH:MM)
   * @returns {Promise<boolean>} Whether the doctor is available
   */
  isDoctorAvailable: async (doctorId, date, startTime, endTime) => {
    try {
      const availability = await availabilityService.getDoctorAvailability(doctorId);
      return availability.isDoctorAvailable(date, startTime, endTime);
    } catch (error) {
      logger.error('Error checking doctor availability', { 
        error: error.message,
        doctorId,
        date,
        startTime,
        endTime
      });
      throw error;
    }
  },

  /**
   * Get calendar events for a doctor (combined schedule, leaves, and breaks)
   * @param {string} doctorId - Doctor ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of calendar events
   */
  getDoctorCalendar: async (doctorId, startDate, endDate) => {
    try {
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Get availability
      const availability = await availabilityService.getDoctorAvailability(doctorId);
      
      // Get leaves
      const leaves = await Leave.find({
        doctorId,
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
        status: 'approved'
      });
      
      // Get appointments
      const appointments = await Appointment.find({
        doctor: doctorId,
        startTime: { $gte: startDate },
        endTime: { $lte: endDate },
        status: { $nin: ['cancelled', 'no-show'] }
      }).populate('patient', 'firstName lastName')
        .populate('appointmentType', 'name color');
      
      // Get break times that are effective during the date range
      const breakTimes = await BreakTime.find({
        doctorId,
        isActive: true,
        $or: [
          { effectiveFrom: { $exists: false } },
          { effectiveFrom: null },
          { effectiveFrom: { $lte: endDate } }
        ],
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: startDate } }
        ]
      });
      
      // Prepare calendar events
      const calendarEvents = [];
      
      // Add working hours
      const days = getDatesBetween(startDate, endDate);
      days.forEach(day => {
        const dayOfWeek = day.getDay();
        const workingDay = availability.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
        
        if (workingDay && workingDay.isWorking) {
          // Check if this is a special date
          const dateStr = day.toISOString().split('T')[0];
          const specialDate = availability.specialDates.find(
            sd => new Date(sd.date).toISOString().split('T')[0] === dateStr
          );
          
          if (specialDate) {
            // Special date overrides regular working hours
            if (specialDate.isWorking) {
              calendarEvents.push({
                title: specialDate.title,
                start: new Date(`${dateStr}T${specialDate.startTime}`),
                end: new Date(`${dateStr}T${specialDate.endTime}`),
                allDay: false,
                color: specialDate.color,
                type: 'special_date',
                description: specialDate.description
              });
            }
          } else {
            // Regular working hours
            calendarEvents.push({
              title: 'Working Hours',
              start: new Date(`${dateStr}T${workingDay.startTime}`),
              end: new Date(`${dateStr}T${workingDay.endTime}`),
              allDay: false,
              color: '#2ecc71', // Green color for working hours
              type: 'working_hours'
            });
          }
        }
      });
      
      // Add leaves
      leaves.forEach(leave => {
        const event = {
          id: `leave_${leave._id}`,
          title: leave.title,
          start: leave.startDate,
          end: leave.endDate,
          allDay: leave.allDay,
          color: leave.color,
          type: 'leave',
          description: leave.description,
          leaveType: leave.type
        };
        
        // For partial day leave, set the specific times
        if (!leave.allDay) {
          const startDateStr = leave.startDate.toISOString().split('T')[0];
          const endDateStr = leave.endDate.toISOString().split('T')[0];
          
          event.start = new Date(`${startDateStr}T${leave.startTime}`);
          event.end = new Date(`${endDateStr}T${leave.endTime}`);
        } else {
          // Full day events should end at the end of the day
          event.end = new Date(event.end);
          event.end.setHours(23, 59, 59);
        }
        
        calendarEvents.push(event);
      });
      
      // Add break times
      breakTimes.forEach(breakTime => {
        // Add break for each applicable day in the date range
        days.forEach(day => {
          if (day.getDay() === breakTime.dayOfWeek) {
            // Check if this break is effective on this day
            if (breakTime.effectiveFrom && new Date(breakTime.effectiveFrom) > day) return;
            if (breakTime.effectiveTo && new Date(breakTime.effectiveTo) < day) return;
            
            const dateStr = day.toISOString().split('T')[0];
            
            calendarEvents.push({
              id: `break_${breakTime._id}_${dateStr}`,
              title: breakTime.title,
              start: new Date(`${dateStr}T${breakTime.startTime}`),
              end: new Date(`${dateStr}T${breakTime.endTime}`),
              allDay: false,
              color: breakTime.color,
              type: 'break',
              description: breakTime.description,
              recurring: true
            });
          }
        });
      });
      
      // Add appointments
      appointments.forEach(appointment => {
        calendarEvents.push({
          id: `appointment_${appointment._id}`,
          title: `${appointment.appointmentType.name}: ${appointment.patient.firstName} ${appointment.patient.lastName}`,
          start: appointment.startTime,
          end: appointment.endTime,
          allDay: false,
          color: appointment.appointmentType.color,
          type: 'appointment',
          appointmentId: appointment._id,
          patientId: appointment.patient._id,
          patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
          appointmentType: appointment.appointmentType.name,
          status: appointment.status
        });
      });
      
      return calendarEvents;
    } catch (error) {
      logger.error('Error getting doctor calendar', { 
        error: error.message,
        doctorId,
        startDate,
        endDate
      });
      throw error;
    }
  }
};

/**
 * Helper function to get all dates between start and end date
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Array of dates
 */
function getDatesBetween(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  
  // Strip time part for accurate date comparison
  currentDate.setHours(0, 0, 0, 0);
  const endDateCopy = new Date(endDate);
  endDateCopy.setHours(0, 0, 0, 0);
  
  while (currentDate <= endDateCopy) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

module.exports = availabilityService;
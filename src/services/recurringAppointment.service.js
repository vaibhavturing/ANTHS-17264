const mongoose = require('mongoose');
const RecurringAppointmentSeries = require('../models/recurringAppointment.model');
const { Appointment } = require('../models/appointment.model');
const appointmentService = require('./appointment.service');
const availabilityService = require('./availability.service');
const holidayService = require('./holiday.service');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');

/**
 * Helper function to add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date} New date with days added
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Helper function to add months to a date
 * @param {Date} date - Base date
 * @param {number} months - Number of months to add
 * @returns {Date} New date with months added
 */
const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

/**
 * Helper function to get same day of week in a future month
 * For example, "3rd Tuesday of the month" in future months
 * @param {Date} date - Base date
 * @param {number} months - Number of months to add
 * @returns {Date} Date with the same relative position in future month
 */
const getSameDayOfWeekInFutureMonth = (date, months) => {
  const originalDate = new Date(date);
  const dayOfWeek = originalDate.getDay();
  
  // Get the first day of the target month
  const targetMonth = new Date(originalDate);
  targetMonth.setMonth(targetMonth.getMonth() + months);
  targetMonth.setDate(1);
  
  // Find which occurrence of this day of week the original date was
  const originalWeekOfMonth = Math.ceil(originalDate.getDate() / 7);
  
  // Find the first occurrence of this day of week in the target month
  let daysToAdd = (7 + dayOfWeek - targetMonth.getDay()) % 7;
  targetMonth.setDate(targetMonth.getDate() + daysToAdd);
  
  // Add the necessary number of weeks
  targetMonth.setDate(targetMonth.getDate() + (originalWeekOfMonth - 1) * 7);
  
  return targetMonth;
};

/**
 * Service for managing recurring appointments in the Healthcare Management Application
 */
const recurringAppointmentService = {
  /**
   * Create a new recurring appointment series
   * @param {Object} data - Recurring appointment data
   * @returns {Promise<Object>} Created recurring appointment series
   */
  createRecurringSeries: async (data) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.info('Creating recurring appointment series', { 
        patientId: data.patient, 
        doctorId: data.doctor 
      });
      
      // Create the recurring appointment series
      const recurringSeriesData = {
        patient: data.patient,
        doctor: data.doctor,
        appointmentType: data.appointmentType,
        frequency: data.frequency,
        timeOfDay: data.timeOfDay,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        duration: data.duration,
        notes: data.notes,
        skipHolidays: data.skipHolidays !== false, // Default to true if not specified
        appointments: []
      };
      
      // Set frequency-specific fields
      if (data.frequency === 'weekly' || data.frequency === 'biweekly') {
        recurringSeriesData.dayOfWeek = data.dayOfWeek;
      } else if (data.frequency === 'monthly') {
        if (data.useSameDayOfWeekMonthly) {
          recurringSeriesData.useSameDayOfWeekMonthly = true;
          // The day of week will be determined from the start date
        } else {
          recurringSeriesData.dayOfMonth = data.dayOfMonth;
        }
      } else if (data.frequency === 'custom') {
        recurringSeriesData.customIntervalDays = data.customIntervalDays;
      }
      
      // Set occurrences or end date
      if (data.occurrences) {
        recurringSeriesData.occurrences = data.occurrences;
        
        // Calculate end date based on occurrences if not provided
        if (!data.endDate) {
          let endDate;
          
          switch (data.frequency) {
            case 'weekly':
              endDate = addDays(new Date(data.startDate), (data.occurrences - 1) * 7);
              break;
            case 'biweekly':
              endDate = addDays(new Date(data.startDate), (data.occurrences - 1) * 14);
              break;
            case 'monthly':
              endDate = addMonths(new Date(data.startDate), data.occurrences - 1);
              break;
            case 'custom':
              endDate = addDays(new Date(data.startDate), (data.occurrences - 1) * data.customIntervalDays);
              break;
            default:
              endDate = addMonths(new Date(data.startDate), 12); // Default to 1 year
          }
          
          recurringSeriesData.endDate = endDate;
        }
      }
      
      // Create the recurring series
      const series = new RecurringAppointmentSeries(recurringSeriesData);
      await series.save({ session });
      
      // Generate the individual appointments in the series
      const generatedAppointments = await recurringAppointmentService.generateAppointmentsForSeries(
        series._id,
        { 
          checkAvailability: true,
          session 
        }
      );
      
      // Update the series with the generated appointment IDs
      series.appointments = generatedAppointments.map(appt => appt._id);
      await series.save({ session });
      
      await session.commitTransaction();
      
      logger.info('Successfully created recurring appointment series', { 
        seriesId: series._id,
        appointmentsCount: series.appointments.length
      });
      
      return {
        series,
        appointments: generatedAppointments
      };
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Failed to create recurring appointment series', { 
        error: error.message,
        patientId: data.patient,
        doctorId: data.doctor
      });
      
      throw error;
    } finally {
      session.endSession();
    }
  },
  
  /**
   * Generate individual appointments for a recurring series
   * @param {string} seriesId - Recurring series ID
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Generated appointments
   */
  generateAppointmentsForSeries: async (seriesId, options = {}) => {
    const { checkAvailability = true, session = null } = options;
    
    try {
      logger.info('Generating appointments for recurring series', { seriesId });
      
      // Get the recurring series
      const series = await RecurringAppointmentSeries.findById(seriesId);
      if (!series) {
        throw new NotFoundError('Recurring appointment series not found');
      }
      
      // Get holidays if we need to skip them
      let holidays = [];
      if (series.skipHolidays) {
        holidays = await holidayService.getHolidaysInRange(series.startDate, series.endDate);
      }
      
      // Parse time of day
      const [hours, minutes] = series.timeOfDay.split(':').map(num => parseInt(num, 10));
      
      // Initialize start date with the correct time
      let currentDate = new Date(series.startDate);
      currentDate.setHours(hours, minutes, 0, 0);
      
      // End date for generation
      const endDate = new Date(series.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      // Maximum number of appointments
      const maxAppointments = series.occurrences || 100; // Reasonable upper limit
      
      const appointments = [];
      let position = 1;
      
      // Generate appointments until end date or max occurrences
      while (currentDate <= endDate && appointments.length < maxAppointments) {
        // Skip if date is a holiday
        const isHoliday = holidays.some(holiday => 
          holiday.date.getFullYear() === currentDate.getFullYear() && 
          holiday.date.getMonth() === currentDate.getMonth() && 
          holiday.date.getDate() === currentDate.getDate()
        );
        
        // Skip if date is in exceptions
        const isException = series.exceptions && series.exceptions.some(exc => 
          exc.getFullYear() === currentDate.getFullYear() && 
          exc.getMonth() === currentDate.getMonth() && 
          exc.getDate() === currentDate.getDate()
        );
        
        let skipThisDate = isHoliday || isException;
        let availabilityCheckPassed = true;
        
        // If not skipping, check doctor's availability if requested
        if (!skipThisDate && checkAvailability) {
          const startTime = new Date(currentDate);
          const endTime = new Date(currentDate);
          endTime.setMinutes(endTime.getMinutes() + series.duration);
          
          // Check if slot is available
          availabilityCheckPassed = await appointmentService.checkSlotAvailability(
            series.doctor, 
            startTime, 
            endTime
          );
          
          if (!availabilityCheckPassed && series.autoReschedule) {
            // Try to find an available slot in the reschedule window
            const rescheduleWindow = series.rescheduleWindowDays || 3;
            let foundRescheduleSlot = false;
            
            for (let i = 1; i <= rescheduleWindow; i++) {
              // Try days after the original date
              const rescheduleDate = new Date(currentDate);
              rescheduleDate.setDate(rescheduleDate.getDate() + i);
              
              // Skip weekends and holidays in the reschedule attempt too
              const isRescheduleHoliday = holidays.some(holiday => 
                holiday.date.getFullYear() === rescheduleDate.getFullYear() && 
                holiday.date.getMonth() === rescheduleDate.getMonth() && 
                holiday.date.getDate() === rescheduleDate.getDate()
              );
              
              if (isRescheduleHoliday || rescheduleDate.getDay() === 0 || rescheduleDate.getDay() === 6) {
                continue;
              }
              
              // Check if this reschedule date is available
              const rescheduleStartTime = new Date(rescheduleDate);
              rescheduleStartTime.setHours(hours, minutes, 0, 0);
              
              const rescheduleEndTime = new Date(rescheduleStartTime);
              rescheduleEndTime.setMinutes(rescheduleEndTime.getMinutes() + series.duration);
              
              const isRescheduleAvailable = await appointmentService.checkSlotAvailability(
                series.doctor, 
                rescheduleStartTime, 
                rescheduleEndTime
              );
              
              if (isRescheduleAvailable) {
                // Use this rescheduled date/time
                currentDate = rescheduleStartTime;
                availabilityCheckPassed = true;
                foundRescheduleSlot = true;
                break;
              }
            }
            
            // If auto-reschedule failed, skip this occurrence
            if (!foundRescheduleSlot) {
              skipThisDate = true;
            }
          } else if (!availabilityCheckPassed) {
            // Skip this date if not available and not auto-rescheduling
            skipThisDate = true;
          }
        }
        
        // Create the appointment if not skipping
        if (!skipThisDate && availabilityCheckPassed) {
          const startTime = new Date(currentDate);
          const endTime = new Date(currentDate);
          endTime.setMinutes(endTime.getMinutes() + series.duration);
          
          // Create the appointment
          const appointment = new Appointment({
            patient: series.patient,
            doctor: series.doctor,
            appointmentType: series.appointmentType,
            startTime: startTime,
            endTime: endTime,
            duration: series.duration,
            status: 'scheduled',
            notes: series.notes,
            isPartOfSeries: true,
            recurringSeriesId: series._id,
            seriesPosition: position
          });
          
          if (session) {
            await appointment.save({ session });
          } else {
            await appointment.save();
          }
          
          appointments.push(appointment);
          position++;
        }
        
        // Move to next occurrence date based on frequency
        switch (series.frequency) {
          case 'weekly':
            currentDate = addDays(currentDate, 7);
            break;
          case 'biweekly':
            currentDate = addDays(currentDate, 14);
            break;
          case 'monthly':
            if (series.useSameDayOfWeekMonthly) {
              currentDate = getSameDayOfWeekInFutureMonth(currentDate, 1);
            } else {
              currentDate = addMonths(currentDate, 1);
            }
            break;
          case 'custom':
            currentDate = addDays(currentDate, series.customIntervalDays);
            break;
          default:
            // Default to weekly
            currentDate = addDays(currentDate, 7);
        }
      }
      
      logger.info('Successfully generated appointments for recurring series', { 
        seriesId,
        appointmentsCount: appointments.length
      });
      
      return appointments;
    } catch (error) {
      logger.error('Failed to generate appointments for recurring series', {
        error: error.message,
        seriesId
      });
      
      throw error;
    }
  },
  
  /**
   * Get a recurring appointment series by ID
   * @param {string} id - Series ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Recurring appointment series
   */
  getRecurringSeriesById: async (id, options = {}) => {
    try {
      logger.info('Getting recurring appointment series by ID', { seriesId: id });
      
      let query = RecurringAppointmentSeries.findById(id);
      
      if (options.populateAppointments) {
        query = query.populate({
          path: 'appointments',
          options: { sort: { startTime: 1 } }
        });
      }
      
      if (options.populatePatient) {
        query = query.populate('patient', 'firstName lastName email');
      }
      
      if (options.populateDoctor) {
        query = query.populate('doctor', 'firstName lastName email');
      }
      
      if (options.populateAppointmentType) {
        query = query.populate('appointmentType');
      }
      
      const series = await query.exec();
      
      if (!series) {
        throw new NotFoundError('Recurring appointment series not found');
      }
      
      logger.info('Successfully got recurring series by ID', { seriesId: id });
      
      return series;
    } catch (error) {
      logger.error('Failed to get recurring series by ID', { 
        error: error.message,
        seriesId: id
      });
      
      throw error;
    }
  },
  
  /**
   * Get recurring series for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} List of recurring series
   */
  getPatientRecurringSeries: async (patientId, filters = {}) => {
    try {
      logger.info('Getting recurring series for patient', { 
        patientId, 
        filters 
      });
      
      let query = {
        patient: patientId
      };
      
      // Add status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Add date range filters if provided
      if (filters.startDate) {
        query.endDate = { $gte: new Date(filters.startDate) };
      }
      
      if (filters.endDate) {
        query.startDate = { $lte: new Date(filters.endDate) };
      }
      
      // Default sort by start date descending (most recent first)
      let sort = { startDate: -1 };
      if (filters.sort) {
        sort = filters.sort;
      }
      
      const series = await RecurringAppointmentSeries.find(query)
        .sort(sort)
        .populate('doctor', 'firstName lastName email')
        .populate('appointmentType');
      
      logger.info('Successfully got patient recurring series', { 
        patientId, 
        count: series.length 
      });
      
      return series;
    } catch (error) {
      logger.error('Failed to get patient recurring series', { 
        error: error.message,
        patientId
      });
      
      throw error;
    }
  },
  
  /**
   * Update a recurring appointment series
   * @param {string} id - Series ID
   * @param {Object} data - Updated series data
   * @param {string} updateMode - How to apply updates ('this', 'thisAndFuture', 'all')
   * @returns {Promise<Object>} Updated series
   */
  updateRecurringSeries: async (id, data, updateMode = 'all') => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.info('Updating recurring appointment series', { 
        seriesId: id, 
        updateMode 
      });
      
      // Get the existing series
      const series = await RecurringAppointmentSeries.findById(id);
      if (!series) {
        throw new NotFoundError('Recurring appointment series not found');
      }
      
      // Get all appointments in the series ordered by date
      const appointments = await Appointment.find({
        recurringSeriesId: id,
        status: { $nin: ['cancelled', 'no-show'] }
      }).sort({ startTime: 1 });
      
      const now = new Date();
      
      // Apply updates differently based on updateMode
      if (updateMode === 'all') {
        // Update the entire series
        
        // Update the series fields
        if (data.notes) series.notes = data.notes;
        if (data.status) series.status = data.status;
        
        // Save the updated series
        await series.save({ session });
        
        // Update all future appointments
        for (const appointment of appointments) {
          // Only update future appointments
          if (appointment.startTime > now) {
            if (data.notes) appointment.notes = data.notes;
            if (data.status === 'cancelled') appointment.status = 'cancelled';
            await appointment.save({ session });
          }
        }
      } else if (updateMode === 'thisAndFuture') {
        // Update this and all future occurrences
        
        // Find the specified occurrence by position or date
        let targetPosition = data.startPosition || 1;
        let targetDate = data.startDate ? new Date(data.startDate) : null;
        
        let updateIndex = 0;
        
        if (targetDate) {
          // Find the first occurrence on or after the target date
          for (let i = 0; i < appointments.length; i++) {
            if (appointments[i].startTime >= targetDate) {
              updateIndex = i;
              break;
            }
          }
        } else {
          // Find the occurrence by position
          updateIndex = appointments.findIndex(a => a.seriesPosition === targetPosition);
          if (updateIndex === -1) updateIndex = 0;
        }
        
        // Handle status changes for the original series
        if (data.status === 'cancelled') {
          // If cancelling all future occurrences
          if (updateIndex === 0) {
            series.status = 'cancelled';
          } else {
            series.status = 'partially_cancelled';
            
            // Add exception dates for cancelled occurrences
            for (let i = updateIndex; i < appointments.length; i++) {
              const appointmentDate = new Date(appointments[i].startTime);
              series.exceptions.push(appointmentDate);
              
              // Cancel the appointment
              appointments[i].status = 'cancelled';
              appointments[i].cancellationReason = 'Series cancelled';
              await appointments[i].save({ session });
            }
          }
          
          await series.save({ session });
          
        } else if (data.notes) {
          // Just updating notes for future occurrences
          for (let i = updateIndex; i < appointments.length; i++) {
            appointments[i].notes = data.notes;
            await appointments[i].save({ session });
          }
          
          series.notes = data.notes;
          await series.save({ session });
        }
      } else if (updateMode === 'this') {
        // Update only the specified occurrence
        
        // Find the target appointment by position or date
        let targetAppointment;
        
        if (data.date) {
          const targetDate = new Date(data.date);
          targetAppointment = appointments.find(a => {
            const apptDate = new Date(a.startTime);
            return apptDate.getFullYear() === targetDate.getFullYear() && 
                   apptDate.getMonth() === targetDate.getMonth() && 
                   apptDate.getDate() === targetDate.getDate();
          });
        } else if (data.position) {
          targetAppointment = appointments.find(a => a.seriesPosition === data.position);
        }
        
        if (!targetAppointment) {
          throw new NotFoundError('Target appointment not found in series');
        }
        
        // Update just this occurrence
        if (data.notes) targetAppointment.notes = data.notes;
        if (data.status) targetAppointment.status = data.status;
        
        // Mark as modified from the series pattern
        targetAppointment.isModifiedOccurrence = true;
        
        await targetAppointment.save({ session });
      }
      
      await session.commitTransaction();
      
      logger.info('Successfully updated recurring appointment series', { 
        seriesId: id,
        updateMode
      });
      
      // Return the updated series and affected appointments
      return {
        series: await RecurringAppointmentSeries.findById(id),
        updatedAppointments: await Appointment.find({
          recurringSeriesId: id,
          status: { $nin: ['cancelled', 'no-show'] }
        }).sort({ startTime: 1 })
      };
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Failed to update recurring appointment series', { 
        error: error.message,
        seriesId: id,
        updateMode
      });
      
      throw error;
    } finally {
      session.endSession();
    }
  },
  
  /**
   * Cancel a recurring appointment series
   * @param {string} id - Series ID
   * @param {Object} options - Cancellation options
   * @returns {Promise<Object>} Cancellation result
   */
  cancelRecurringSeries: async (id, options = {}) => {
    const { reason = '', cancelMode = 'all', startDate } = options;
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.info('Cancelling recurring appointment series', { 
        seriesId: id, 
        cancelMode 
      });
      
      const series = await RecurringAppointmentSeries.findById(id);
      if (!series) {
        throw new NotFoundError('Recurring appointment series not found');
      }
      
      // Get all active appointments in the series
      const appointments = await Appointment.find({
        recurringSeriesId: id,
        status: { $nin: ['cancelled', 'no-show', 'completed'] }
      }).sort({ startTime: 1 });
      
      const now = new Date();
      
      if (cancelMode === 'all') {
        // Cancel the entire series
        series.status = 'cancelled';
        await series.save({ session });
        
        // Cancel all future appointments
        for (const appointment of appointments) {
          if (appointment.startTime > now) {
            appointment.status = 'cancelled';
            appointment.cancellationReason = reason;
            await appointment.save({ session });
          }
        }
      } else if (cancelMode === 'future') {
        // Cancel from a specific date forward
        const cancelDate = startDate ? new Date(startDate) : now;
        
        // Mark the series as partially cancelled
        series.status = 'partially_cancelled';
        
        // Add exception dates for cancelled occurrences
        for (const appointment of appointments) {
          if (appointment.startTime >= cancelDate) {
            const appointmentDate = new Date(appointment.startTime);
            series.exceptions.push(appointmentDate);
            
            appointment.status = 'cancelled';
            appointment.cancellationReason = reason;
            await appointment.save({ session });
          }
        }
        
        await series.save({ session });
      }
      
      await session.commitTransaction();
      
      logger.info('Successfully cancelled recurring appointment series', { 
        seriesId: id,
        cancelMode
      });
      
      return {
        success: true,
        message: `Recurring series ${cancelMode === 'all' ? 'fully' : 'partially'} cancelled`,
        seriesId: id,
        cancelledAppointments: appointments.filter(a => a.status === 'cancelled').length
      };
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Failed to cancel recurring appointment series', { 
        error: error.message,
        seriesId: id
      });
      
      throw error;
    } finally {
      session.endSession();
    }
  }
};

module.exports = recurringAppointmentService;
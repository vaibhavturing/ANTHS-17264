const mongoose = require('mongoose');
const { Appointment, RecurringAppointmentSeries } = require('../models/appointment.model');
const AppointmentType = require('../models/appointmentType.model');
const User = require('../models/user.model');
const availabilityService = require('./availability.service');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

/**
 * Service for managing appointments in the Healthcare Management Application
 */
const appointmentService = {


  /**
 * Initialize default appointment types in the system
 * @returns {Promise<Array>} Created default appointment types
 */
initializeDefaultTypes: async () => {
  try {
    logger.info('Initializing default appointment types');
    
    // Check if we already have types in the system
    const existingCount = await AppointmentType.countDocuments();
    if (existingCount > 0) {
      logger.info('Appointment types already exist, skipping initialization');
      return { message: 'Appointment types already initialized' };
    }
    
    // CHANGE: Enhanced default types with priority and more distinctive colors
    const defaultTypes = [
      {
        name: 'New Patient',
        description: 'Initial consultation for new patients',
        duration: 45,
        bufferTime: 5,
        requirements: ['Complete registration form', 'Bring ID and insurance card'],
        isNewPatient: true,
        color: '#27ae60', // Green
        priority: 'normal'
      },
      {
        name: 'Follow-Up',
        description: 'Follow-up appointment for existing patients',
        duration: 15,
        bufferTime: 5,
        requirements: ['Bring updated medication list'],
        color: '#3498db', // Blue
        priority: 'normal'
      },
      {
        name: 'Telehealth',
        description: 'Virtual appointment via video conference',
        duration: 20,
        bufferTime: 0,
        requirements: ['Stable internet connection', 'Quiet private space'],
        requiresVideoLink: true,
        color: '#9b59b6', // Purple
        priority: 'normal'
      },
      {
        name: 'Annual Physical',
        description: 'Comprehensive yearly physical examination',
        duration: 60,
        bufferTime: 10,
        requirements: ['Fasting for 8 hours prior', 'Wear comfortable clothing'],
        color: '#f39c12', // Orange
        priority: 'normal'
      },
      {
        name: 'Urgent Care',
        description: 'Immediate care for non-emergency conditions',
        duration: 30,
        bufferTime: 0,
        requirements: ['Bring list of current symptoms'],
        color: '#e74c3c', // Red
        priority: 'high'
      },
      {
        name: 'Emergency',
        description: 'Emergency medical care',
        duration: 60,
        bufferTime: 0,
        requirements: [],
        color: '#c0392b', // Dark Red
        priority: 'urgent'
      },
      {
        name: 'Lab Work',
        description: 'Blood tests and other laboratory work',
        duration: 15,
        bufferTime: 5,
        requirements: ['Fasting may be required for certain tests'],
        color: '#16a085', // Teal
        priority: 'low'
      },
      {
        name: 'Specialist Consultation',
        description: 'Consultation with a medical specialist',
        duration: 45,
        bufferTime: 5,
        requirements: ['Referral from primary care physician'],
        color: '#8e44ad', // Dark Purple
        priority: 'normal'
      }
    ];
    
    // Insert all default types
    const createdTypes = await AppointmentType.insertMany(defaultTypes);
    
    logger.info('Successfully initialized default appointment types', { 
      count: createdTypes.length 
    });
    
    return createdTypes;
  } catch (error) {
    logger.error('Failed to initialize default appointment types', { 
      error: error.message 
    });
    throw error;
  }
},
  /**
   * Create a new appointment
   * @param {Object} data - Appointment data
   * @param {string} [lockId] - Optional lock ID if slot is already locked
   * @returns {Promise<Object>} Created appointment
   */
  createAppointment: async (data, lockId = null) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      logger.info('Creating appointment', { patientId: data.patient, doctorId: data.doctor });
      
      // Verify the doctor exists
      const doctor = await User.findById(data.doctor).lean();
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Verify the patient exists
      const patient = await User.findById(data.patient).lean();
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Get appointment type details
      const appointmentType = await AppointmentType.findById(data.appointmentType).lean();
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }

      // Calculate end time based on appointment duration
      const startTime = new Date(data.startTime);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + appointmentType.duration + (appointmentType.bufferTime || 0));
      
      // If no lock ID is provided, check if slot is available and lock it
      // This is a new feature for real-time availability checking and slot blocking
      if (!lockId) {
        const isAvailable = await appointmentService.checkSlotAvailability(
          data.doctor, 
          startTime, 
          endTime
        );
        
        if (!isAvailable) {
          throw new ConflictError('This time slot is no longer available');
        }
        
        // Generate a lock ID and lock the slot temporarily
        lockId = uuidv4();
        await appointmentService.lockTimeSlot(
          data.doctor, 
          startTime, 
          endTime, 
          lockId, 
          15 // Lock for 15 minutes
        );
      } else {
        // Verify the lock exists and belongs to this booking attempt
        const lockExists = await appointmentService.verifySlotLock(
          data.doctor, 
          startTime, 
          endTime, 
          lockId
        );
        
        if (!lockExists) {
          throw new ConflictError('Your booking session has expired, please try again');
        }
      }
      
      // Create the appointment
      const appointment = new Appointment({
        patient: data.patient,
        doctor: data.doctor,
        appointmentType: data.appointmentType,
        startTime: startTime,
        endTime: endTime,
        duration: appointmentType.duration,
        status: 'scheduled',
        notes: data.notes,
        specialInstructions: data.specialInstructions,
        isRecurring: false
      });
      
      // Add videoLink for telehealth appointments
      if (appointmentType.requiresVideoLink) {
        // In a real implementation, this might generate a secure meeting link
        appointment.videoLink = `https://healthcare-app.example.com/telehealth/${appointment._id}`;
      }
      
      await appointment.save({ session });
      
      // Remove the temporary lock after successful booking
      await Appointment.findByIdAndUpdate(
        appointment._id,
        { 'temporaryLock.isLocked': false },
        { session }
      );
      
      await session.commitTransaction();
      
      logger.info('Successfully created appointment', { 
        appointmentId: appointment._id
      });
      
      return appointment;
    } catch (error) {
      await session.abortTransaction();
      
      logger.error('Failed to create appointment', { 
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
   * Check if a time slot is available for booking
   * @param {string} doctorId - Doctor's ID
   * @param {Date} startTime - Appointment start time
   * @param {Date} endTime - Appointment end time
   * @returns {Promise<boolean>} Whether the slot is available
   */
  checkSlotAvailability: async (doctorId, startTime, endTime) => {
    try {
      logger.info('Checking slot availability', { 
        doctorId, 
        startTime, 
        endTime 
      });
      
      // Check if doctor is available during this time
      const isDoctorAvailable = await availabilityService.checkDoctorAvailability(
        doctorId, 
        startTime, 
        endTime
      );
      
      if (!isDoctorAvailable) {
        logger.info('Doctor is not available for this time slot', { 
          doctorId, 
          startTime, 
          endTime 
        });
        return false;
      }
      
      // Check if there's any existing appointment or temporary lock
      // This check considers both confirmed appointments and temporarily locked slots
      const conflictingAppointment = await Appointment.findOne({
        doctor: doctorId,
        status: { $nin: ['cancelled', 'no-show'] },
        $or: [
          // Check for overlapping appointments
          {
            $or: [
              { startTime: { $lt: endTime, $gte: startTime } },
              { endTime: { $gt: startTime, $lte: endTime } },
              { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
            ]
          },
          // Check for active temporary locks
          {
            'temporaryLock.isLocked': true,
            'temporaryLock.lockedUntil': { $gt: new Date() },
            $or: [
              { startTime: { $lt: endTime, $gte: startTime } },
              { endTime: { $gt: startTime, $lte: endTime } },
              { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
            ]
          }
        ]
      }).lean();
      
      if (conflictingAppointment) {
        logger.info('Found conflicting appointment or lock', { 
          doctorId, 
          startTime, 
          endTime,
          conflictingAppointmentId: conflictingAppointment._id,
          isLocked: conflictingAppointment.temporaryLock?.isLocked
        });
        return false;
      }
      
      logger.info('Slot is available', { doctorId, startTime, endTime });
      return true;
    } catch (error) {
      logger.error('Error checking slot availability', { 
        error: error.message,
        doctorId,
        startTime,
        endTime
      });
      
      throw error;
    }
  },
  
  /**
   * Lock a time slot temporarily during booking process
   * @param {string} doctorId - Doctor's ID
   * @param {Date} startTime - Appointment start time
   * @param {Date} endTime - Appointment end time
   * @param {string} lockId - Unique lock identifier
   * @param {number} lockDurationMinutes - How long to lock the slot (default: 15 min)
   * @returns {Promise<Object>} Lock details
   */
  lockTimeSlot: async (doctorId, startTime, endTime, lockId, lockDurationMinutes = 15) => {
    try {
      logger.info('Locking time slot', { 
        doctorId, 
        startTime, 
        endTime, 
        lockId,
        lockDurationMinutes 
      });
      
      // Create a temporary appointment to lock the slot
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + lockDurationMinutes);
      
      const tempAppointment = new Appointment({
        doctor: doctorId,
        patient: null, // Will be set during actual booking
        appointmentType: null, // Will be set during actual booking
        startTime: startTime,
        endTime: endTime,
        duration: Math.round((endTime - startTime) / (1000 * 60)), // Duration in minutes
        status: 'pending',
        temporaryLock: {
          isLocked: true,
          lockedUntil: lockedUntil,
          lockId: lockId
        }
      });
      
      await tempAppointment.save();
      
      logger.info('Successfully locked time slot', { 
        doctorId, 
        startTime, 
        endTime, 
        lockId,
        tempAppointmentId: tempAppointment._id,
        lockedUntil 
      });
      
      return {
        lockId,
        appointmentId: tempAppointment._id,
        lockedUntil
      };
    } catch (error) {
      logger.error('Failed to lock time slot', { 
        error: error.message,
        doctorId, 
        startTime, 
        endTime
      });
      
      throw error;
    }
  },
  
  /**
   * Verify that a slot lock exists and is valid
   * @param {string} doctorId - Doctor's ID
   * @param {Date} startTime - Appointment start time
   * @param {Date} endTime - Appointment end time
   * @param {string} lockId - Lock identifier to verify
   * @returns {Promise<boolean>} Whether lock exists and is valid
   */
  verifySlotLock: async (doctorId, startTime, endTime, lockId) => {
    try {
      logger.info('Verifying slot lock', { 
        doctorId, 
        startTime, 
        endTime, 
        lockId 
      });
      
      const lockedAppointment = await Appointment.findOne({
        doctor: doctorId,
        startTime: startTime,
        endTime: endTime,
        'temporaryLock.isLocked': true,
        'temporaryLock.lockId': lockId,
        'temporaryLock.lockedUntil': { $gt: new Date() }
      }).lean();
      
      const isValid = !!lockedAppointment;
      
      logger.info(`Slot lock verification: ${isValid ? 'valid' : 'invalid'}`, { 
        doctorId, 
        startTime, 
        endTime, 
        lockId 
      });
      
      return isValid;
    } catch (error) {
      logger.error('Error verifying slot lock', { 
        error: error.message,
        doctorId, 
        startTime, 
        endTime,
        lockId
      });
      
      throw error;
    }
  },
  
  /**
   * Get available time slots for a doctor on a specific date
   * @param {string} doctorId - Doctor's ID
   * @param {Date} date - Date to check availability
   * @param {string} [appointmentTypeId] - Optional appointment type ID to filter by
   * @returns {Promise<Array>} List of available time slots
   */
  getAvailableTimeSlots: async (doctorId, date, appointmentTypeId = null) => {
    try {
      logger.info('Getting available time slots', { 
        doctorId, 
        date, 
        appointmentTypeId 
      });
      
      // Get the appointment type to determine duration
      let appointmentDuration = 15; // Default duration
      let appointmentBuffer = 0; // Default buffer
      
      if (appointmentTypeId) {
        const appointmentType = await AppointmentType.findById(appointmentTypeId);
        if (appointmentType) {
          appointmentDuration = appointmentType.duration || 15;
          appointmentBuffer = appointmentType.bufferTime || 0;
        }
      }
      
      // Get the start and end of the requested date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Get doctor's schedule for this day
      const doctorAvailability = await availabilityService.getDoctorDailyAvailability(
        doctorId, 
        startOfDay
      );
      
      if (!doctorAvailability || !doctorAvailability.timeSlots || doctorAvailability.timeSlots.length === 0) {
        logger.info('No availability found for doctor on this date', { 
          doctorId, 
          date 
        });
        return [];
      }
      
      // Get all existing appointments for this doctor on this day
      const existingAppointments = await Appointment.find({
        doctor: doctorId,
        startTime: { $gte: startOfDay, $lt: endOfDay },
        status: { $nin: ['cancelled', 'no-show'] }
      }).lean();
      
      // Also get temporarily locked slots
      const lockedSlots = await Appointment.find({
        doctor: doctorId,
        startTime: { $gte: startOfDay, $lt: endOfDay },
        'temporaryLock.isLocked': true,
        'temporaryLock.lockedUntil': { $gt: new Date() }
      }).lean();
      
      // Combine regular appointments and locked slots
      const blockedSlots = [...existingAppointments, ...lockedSlots];
      
      // Calculate available slots based on doctor's schedule and existing appointments
      const availableSlots = [];
      
      // Process each time slot from the doctor's schedule
      for (const timeSlot of doctorAvailability.timeSlots) {
        const slotStart = new Date(timeSlot.startTime);
        const slotEnd = new Date(timeSlot.endTime);
        
        // Generate potential appointment slots at regular intervals
        const totalSlotDuration = (slotEnd - slotStart) / (1000 * 60); // in minutes
        const totalAppointmentDuration = appointmentDuration + appointmentBuffer;
        
        // Calculate how many appointments can fit in this slot
        const possibleAppointments = Math.floor(totalSlotDuration / totalAppointmentDuration);
        
        for (let i = 0; i < possibleAppointments; i++) {
          const potentialStart = new Date(slotStart);
          potentialStart.setMinutes(potentialStart.getMinutes() + (i * totalAppointmentDuration));
          
          const potentialEnd = new Date(potentialStart);
          potentialEnd.setMinutes(potentialEnd.getMinutes() + appointmentDuration);
          
          // Check if this potential slot overlaps with any existing appointment
          const isOverlapping = blockedSlots.some(appointment => {
            const appointmentStart = new Date(appointment.startTime);
            const appointmentEnd = new Date(appointment.endTime);
            
            return (
              (potentialStart < appointmentEnd && potentialStart >= appointmentStart) ||
              (potentialEnd > appointmentStart && potentialEnd <= appointmentEnd) ||
              (potentialStart <= appointmentStart && potentialEnd >= appointmentEnd)
            );
          });
          
          // If not overlapping, this is an available slot
          if (!isOverlapping) {
            availableSlots.push({
              startTime: potentialStart,
              endTime: potentialEnd,
              duration: appointmentDuration
            });
          }
        }
      }
      
      logger.info('Successfully found available time slots', { 
        doctorId, 
        date, 
        count: availableSlots.length 
      });
      
      return availableSlots;
    } catch (error) {
      logger.error('Failed to get available time slots', {
        error: error.message,
        doctorId,
        date,
        appointmentTypeId
      });
      
      throw error;
    }
  },
  
  /**
   * Get appointment by ID
   * @param {string} id - Appointment ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Appointment
   */
  getAppointmentById: async (id, options = {}) => {
    try {
      logger.info('Getting appointment by ID', { appointmentId: id });
      
      let query = Appointment.findById(id);
      
      if (options.populatePatient) {
        query = query.populate('patient', 'firstName lastName email');
      }
      
      if (options.populateDoctor) {
        query = query.populate('doctor', 'firstName lastName email');
      }
      
      if (options.populateAppointmentType) {
        query = query.populate('appointmentType');
      }
      
      const appointment = await query.exec();
      
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }
      
      logger.info('Successfully got appointment by ID', { appointmentId: id });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to get appointment by ID', { 
        error: error.message,
        appointmentId: id
      });
      
      throw error;
    }
  },
  
  /**
   * Update appointment
   * @param {string} id - Appointment ID
   * @param {Object} data - Updated appointment data
   * @returns {Promise<Object>} Updated appointment
   */
  updateAppointment: async (id, data) => {
    try {
      logger.info('Updating appointment', { appointmentId: id });
      
      const appointment = await Appointment.findById(id);
      
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }
      
      // If rescheduling, check availability
      if (data.startTime) {
        const newStartTime = new Date(data.startTime);
        
        // Get appointment type for duration
        const appointmentType = await AppointmentType.findById(
          data.appointmentType || appointment.appointmentType
        );
        
        if (!appointmentType) {
          throw new NotFoundError('Appointment type not found');
        }
        
        const newEndTime = new Date(newStartTime);
        newEndTime.setMinutes(
          newEndTime.getMinutes() + 
          (appointmentType.duration || appointment.duration)
        );
        
        // Check if the new time slot is available
        const isAvailable = await appointmentService.checkSlotAvailability(
          data.doctor || appointment.doctor,
          newStartTime,
          newEndTime,
          id // Exclude current appointment from conflict check
        );
        
        if (!isAvailable) {
          throw new ConflictError('The requested time slot is not available');
        }
        
        appointment.startTime = newStartTime;
        appointment.endTime = newEndTime;
      }
      
      // Update fields if provided
      if (data.doctor) appointment.doctor = data.doctor;
      if (data.patient) appointment.patient = data.patient;
      if (data.appointmentType) appointment.appointmentType = data.appointmentType;
      if (data.status) appointment.status = data.status;
      if (data.notes) appointment.notes = data.notes;
      if (data.specialInstructions) appointment.specialInstructions = data.specialInstructions;
      if (data.videoLink) appointment.videoLink = data.videoLink;
      
      await appointment.save();
      
      logger.info('Successfully updated appointment', { appointmentId: id });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to update appointment', { 
        error: error.message,
        appointmentId: id
      });
      
      throw error;
    }
  },
  
  /**
   * Cancel appointment
   * @param {string} id - Appointment ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancelled appointment
   */
  cancelAppointment: async (id, reason = '') => {
    try {
      logger.info('Cancelling appointment', { appointmentId: id });
      
      const appointment = await Appointment.findById(id);
      
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }
      
      appointment.status = 'cancelled';
      appointment.cancellationReason = reason;
      
      await appointment.save();
      
      logger.info('Successfully cancelled appointment', { appointmentId: id });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to cancel appointment', { 
        error: error.message,
        appointmentId: id
      });
      
      throw error;
    }
  },
  
  /**
   * Get appointments for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} List of appointments
   */
  getPatientAppointments: async (patientId, filters = {}) => {
    try {
      logger.info('Getting appointments for patient', { 
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
        query.startTime = { $gte: new Date(filters.startDate) };
      }
      
      if (filters.endDate) {
        if (!query.startTime) {
          query.startTime = {};
        }
        query.startTime.$lte = new Date(filters.endDate);
      }
      
      // Default sort by start time descending (most recent first)
      let sort = { startTime: -1 };
      if (filters.sort) {
        sort = filters.sort;
      }
      
      const appointments = await Appointment.find(query)
        .sort(sort)
        .populate('doctor', 'firstName lastName email')
        .populate('appointmentType')
        .lean();
      
      logger.info('Successfully got patient appointments', { 
        patientId, 
        count: appointments.length 
      });
      
      return appointments;
    } catch (error) {
      logger.error('Failed to get patient appointments', { 
        error: error.message,
        patientId
      });
      
      throw error;
    }
  },
  
  /**
   * Get appointments for a doctor
   * @param {string} doctorId - Doctor ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} List of appointments
   */
  getDoctorAppointments: async (doctorId, filters = {}) => {
    try {
      logger.info('Getting appointments for doctor', { 
        doctorId, 
        filters 
      });
      
      let query = {
        doctor: doctorId
      };
      
      // Add status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Add date range filters if provided
      if (filters.startDate) {
        query.startTime = { $gte: new Date(filters.startDate) };
      }
      
      if (filters.endDate) {
        if (!query.startTime) {
          query.startTime = {};
        }
        query.startTime.$lte = new Date(filters.endDate);
      }
      
      // Default sort by start time ascending (earlier first)
      let sort = { startTime: 1 };
      if (filters.sort) {
        sort = filters.sort;
      }
      
      const appointments = await Appointment.find(query)
        .sort(sort)
        .populate('patient', 'firstName lastName email')
        .populate('appointmentType')
        .lean();
      
      logger.info('Successfully got doctor appointments', { 
        doctorId, 
        count: appointments.length 
      });
      
      return appointments;
    } catch (error) {
      logger.error('Failed to get doctor appointments', { 
        error: error.message,
        doctorId
      });
      
      throw error;
    }
  },
  
  /**
   * Cleanup expired temporary locks
   * This would typically be run by a scheduled job
   * @returns {Promise<Object>} Cleanup result
   */
  cleanupExpiredLocks: async () => {
    try {
      logger.info('Cleaning up expired temporary locks');
      
      const result = await Appointment.deleteMany({
        'temporaryLock.isLocked': true,
        'temporaryLock.lockedUntil': { $lt: new Date() },
        patient: null // Only delete temporary lock appointments that haven't been confirmed
      });
      
      logger.info('Successfully cleaned up expired locks', { 
        count: result.deletedCount 
      });
      
      return { 
        success: true, 
        deletedCount: result.deletedCount 
      };
    } catch (error) {
      logger.error('Failed to clean up expired locks', { 
        error: error.message 
      });
      
      throw error;
    }
  }
};

module.exports = appointmentService;
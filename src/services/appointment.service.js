const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const AppointmentType = require('../models/appointmentType.model');
const Waitlist = require('../models/waitlist.model');
const DoctorSettings = require('../models/doctorSettings.model');
const scheduleService = require('./schedule.service');
const availabilityService = require('./availability.service');
const notificationService = require('./notification.service');
const emailService = require('./email.service');
const { AppointmentError } = require('../utils/errors');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const moment = require('moment');
const config = require('../config/config');

/**
 * Service for appointment-related operations
 */
const appointmentService = {
  /**
   * Create a new appointment
   * @param {Object} appointmentData - Appointment data
   * @returns {Promise<Object>} Created appointment
   */
  createAppointment: async (appointmentData) => {
    // Initialize transaction session for handling concurrent appointments
    const session = await startSession();
    session.startTransaction();
    
    try {
      const { patientId, doctorId, startTime, endTime, reason, type, notes } = appointmentData;
      
      // OPTIMIZATION: Added indexes on Doctor/Patient models for faster lookups
      // Validate doctor and patient exist (using lean() for better performance)
      const [doctor, patient] = await Promise.all([
        Doctor.findById(doctorId).lean().session(session),
        Patient.findById(patientId).lean().session(session)
      ]);
      
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Parse dates
      const appointmentStart = new Date(startTime);
      const appointmentEnd = new Date(endTime);
      
      // Validate appointment times
      if (appointmentEnd <= appointmentStart) {
        throw new ValidationError('End time must be after start time');
      }
      
      if (appointmentStart < new Date()) {
        throw new ValidationError('Cannot book appointments in the past');
      }
      
      // OPTIMIZATION: Added compound index for overlapping appointment queries
      // Check for overlapping appointments using findOne instead of find for better performance
      const overlappingAppointment = await Appointment.findOne({
        doctorId,
        $or: [
          { startTime: { $lt: appointmentEnd, $gte: appointmentStart } },
          { endTime: { $gt: appointmentStart, $lte: appointmentEnd } },
          { 
            startTime: { $lte: appointmentStart },
            endTime: { $gte: appointmentEnd }
          }
        ]
      }).lean().session(session);
      
      if (overlappingAppointment) {
        throw new BusinessLogicError('Doctor already has an appointment during this time');
      }
      
      // OPTIMIZATION: Using async creation with transaction
      // Create the appointment
      const appointment = new Appointment({
        patientId,
        doctorId,
        startTime: appointmentStart,
        endTime: appointmentEnd,
        reason,
        type,
        notes,
        status: 'scheduled'
      });

      // OPTIMIZATION: Added write concern for critical operations
      await appointment.save({ 
        session,
        writeConcern: { w: 'majority' }
      });
      
      // Commit the transaction
      await session.commitTransaction();
      session.endSession();
      
      // OPTIMIZATION: Only return essential data to reduce payload size
      return {
        id: appointment._id,
        patientId,
        doctorId,
        startTime: appointmentStart,
        endTime: appointmentEnd,
        status: appointment.status,
        type: appointment.type
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Error creating appointment', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },
  
  /**
   * Get appointment by ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Appointment details
   */
  getAppointmentById: async (appointmentId) => {
    try {
      // OPTIMIZATION: Using projection to retrieve only needed fields
      const appointment = await Appointment.findById(appointmentId)
        .select('patientId doctorId startTime endTime reason type notes status createdAt')
        .lean(); // Using lean() for better performance
      
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }
      
      return appointment;
    } catch (error) {
      logger.error('Error fetching appointment by ID', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  },
  
  /**
   * Get appointments for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} options - Query options (pagination, filters)
   * @returns {Promise<Array>} List of appointments
   */
  getAppointmentsForPatient: async (patientId, options = {}) => {
    try {
      const { status, startDate, endDate, page = 1, limit = 10 } = options;
      
      // Build query filters
      const filters = { patientId };
      
      if (status) {
        filters.status = status;
      }
      
      // OPTIMIZATION: Add date range filters for faster querying
      if (startDate || endDate) {
        filters.startTime = {};
        if (startDate) {
          filters.startTime.$gte = new Date(startDate);
        }
        if (endDate) {
          filters.startTime.$lte = new Date(endDate);
        }
      }
      
      // Calculate pagination
      const skip = (page - 1) * parseInt(limit);
      
      // OPTIMIZATION: Use countDocuments instead of estimatedDocumentCount for filtered queries
      // Get total count for pagination (perform in parallel with main query)
      const countPromise = Appointment.countDocuments(filters);
      
      // OPTIMIZATION: Use index for sorting + Add projection to retrieve only needed fields
      // Get appointments with pagination
      const appointmentsPromise = Appointment.find(filters)
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('patientId doctorId startTime endTime reason type status')
        .lean(); // Using lean() for better performance
      
      // Execute both queries in parallel
      const [count, appointments] = await Promise.all([countPromise, appointmentsPromise]);
      
      // Return with pagination metadata
      return {
        appointments,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching appointments for patient', { 
        error: error.message,
        patientId 
      });
      throw error;
    }
  },
  
  /**
   * Get appointments for a doctor
   * @param {string} doctorId - Doctor ID
   * @param {Object} options - Query options (pagination, filters)
   * @returns {Promise<Array>} List of appointments
   */
  getAppointmentsForDoctor: async (doctorId, options = {}) => {
    try {
      const { status, startDate, endDate, page = 1, limit = 10 } = options;
      
      // Build query filters
      const filters = { doctorId };
      
      if (status) {
        filters.status = status;
      }
      
      // Add date range filters
      if (startDate || endDate) {
        filters.startTime = {};
        if (startDate) {
          filters.startTime.$gte = new Date(startDate);
        }
        if (endDate) {
          filters.startTime.$lte = new Date(endDate);
        }
      }
      
      // Calculate pagination
      const skip = (page - 1) * parseInt(limit);
      
      // Get total count for pagination (perform in parallel with main query)
      const countPromise = Appointment.countDocuments(filters);
      
      // OPTIMIZATION: Added compound index on doctorId + startTime for schedule queries
      // Get appointments with pagination
      const appointmentsPromise = Appointment.find(filters)
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('patientId doctorId startTime endTime reason type status')
        .lean(); // Using lean() for better performance
      
      // Execute both queries in parallel
      const [count, appointments] = await Promise.all([countPromise, appointmentsPromise]);
      
      // Return with pagination metadata
      return {
        appointments,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      };
    } catch (error) {
      logger.error('Error fetching appointments for doctor', { 
        error: error.message,
        doctorId 
      });
      throw error;
    }
  },
  
  /**
   * Check doctor availability for a specific time slot
   * @param {string} doctorId - Doctor ID
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @returns {Promise<boolean>} Whether the doctor is available
   */
  checkDoctorAvailability: async (doctorId, startTime, endTime) => {
    try {
      // Parse dates
      const slotStart = new Date(startTime);
      const slotEnd = new Date(endTime);
      
      // OPTIMIZATION: Using countDocuments instead of find() for checking availability
      // This avoids retrieving the whole document when we only need to know if any exist
      const overlappingAppointmentsCount = await Appointment.countDocuments({
        doctorId,
        status: { $nin: ['cancelled', 'no-show'] },
        $or: [
          { startTime: { $lt: slotEnd, $gte: slotStart } },
          { endTime: { $gt: slotStart, $lte: slotEnd } },
          { 
            startTime: { $lte: slotStart },
            endTime: { $gte: slotEnd }
          }
        ]
      });
      
      // Return true if no overlapping appointments found
      return overlappingAppointmentsCount === 0;
    } catch (error) {
      logger.error('Error checking doctor availability', { 
        error: error.message,
        doctorId,
        startTime,
        endTime
      });
      throw error;
    }
  },
  
  /**
   * Get available time slots for a doctor on a specific date
   * @param {string} doctorId - Doctor ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} List of available time slots
   */
  getAvailableSlotsForDoctor: async (doctorId, date) => {
    try {
      // OPTIMIZATION: Cache doctor working hours to reduce DB queries
      // Get doctor working hours
      const doctor = await Doctor.findById(doctorId)
        .select('workingHours availability')
        .lean();
      
      if (!doctor) {
        throw new NotFoundError('Doctor not found');
      }
      
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
      
      // Map day index to key in working hours
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayKey = days[dayOfWeek];
      
      // Check if doctor works on this day
      if (!doctor.workingHours || !doctor.workingHours[dayKey] || doctor.workingHours[dayKey].isClosed) {
        return { slots: [] }; // Doctor doesn't work on this day
      }
      
      const workingHours = doctor.workingHours[dayKey];
      const startHour = parseInt(workingHours.startTime.split(':')[0]);
      const startMinute = parseInt(workingHours.startTime.split(':')[1]);
      const endHour = parseInt(workingHours.endTime.split(':')[0]);
      const endMinute = parseInt(workingHours.endTime.split(':')[1]);
      
      // Set the start and end time for the day
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(startHour, startMinute, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(endHour, endMinute, 0, 0);
      
      // Default slot duration is 30 minutes
      const slotDuration = 30; // in minutes
      
      // Generate all possible slots for the day
      const allSlots = [];
      let currentSlot = new Date(startOfDay);
      
      while (currentSlot < endOfDay) {
        const slotStart = new Date(currentSlot);
        const slotEnd = new Date(currentSlot);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);
        
        if (slotEnd <= endOfDay) {
          allSlots.push({
            startTime: slotStart,
            endTime: slotEnd
          });
        }
        
        // Move to next slot
        currentSlot.setMinutes(currentSlot.getMinutes() + slotDuration);
      }
      
      // OPTIMIZATION: Using one bulk query instead of checking each slot individually
      // Get all appointments for the day
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      const appointments = await Appointment.find({
        doctorId,
        status: { $nin: ['cancelled', 'no-show'] },
        startTime: { $gte: dayStart, $lt: dayEnd }
      })
        .select('startTime endTime')
        .lean();
      
      // Filter out the booked slots
      const availableSlots = allSlots.filter(slot => {
        // Check if slot overlaps with any appointment
        return !appointments.some(appointment => {
          const appointmentStart = new Date(appointment.startTime);
          const appointmentEnd = new Date(appointment.endTime);
          
          // Check for overlap
          return (
            (slot.startTime < appointmentEnd && slot.startTime >= appointmentStart) ||
            (slot.endTime > appointmentStart && slot.endTime <= appointmentEnd) ||
            (slot.startTime <= appointmentStart && slot.endTime >= appointmentEnd)
          );
        });
      });
      
      // Check doctor's blocked time slots in availability
      const blockedTimeSlots = doctor.availability?.blockedTimeSlots || [];
      
      // Filter out blocked time slots
      const finalAvailableSlots = availableSlots.filter(slot => {
        return !blockedTimeSlots.some(blockedSlot => {
          const blockedStart = new Date(blockedSlot.startTime);
          const blockedEnd = new Date(blockedSlot.endTime);
          
          // Get date only parts for comparison (ignoring time)
          const blockedDateOnly = new Date(blockedStart);
          blockedDateOnly.setHours(0, 0, 0, 0);
          
          const slotDateOnly = new Date(slot.startTime);
          slotDateOnly.setHours(0, 0, 0, 0);
          
          // If dates don't match, slot is not blocked
          if (blockedDateOnly.getTime() !== slotDateOnly.getTime()) {
            return false;
          }
          
          // Check for time overlap
          return (
            (slot.startTime < blockedEnd && slot.startTime >= blockedStart) ||
            (slot.endTime > blockedStart && slot.endTime <= blockedEnd) ||
            (slot.startTime <= blockedStart && slot.endTime >= blockedEnd)
          );
        });
      });
      
      // Format slots for response
      const slots = finalAvailableSlots.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime
      }));
      
      return { slots };
    } catch (error) {
      logger.error('Error getting available slots for doctor', { 
        error: error.message,
        doctorId,
        date 
      });
      throw error;
    }
  },
  
  /**
   * Update an appointment
   * @param {string} appointmentId - Appointment ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User making the update
   * @returns {Promise<Object>} Updated appointment
   */
  updateAppointment: async (appointmentId, updateData, userId) => {
    // Initialize transaction session
    const session = await startSession();
    session.startTransaction();
    
    try {
      // Get existing appointment with locking
      const appointment = await Appointment.findById(appointmentId).session(session);
      
      if (!appointment) {
        throw new NotFoundError('Appointment not found');
      }
      
      // Check if appointment can be updated (not completed or cancelled)
      if (['completed', 'cancelled', 'no-show'].includes(appointment.status)) {
        throw new BusinessLogicError(`Cannot update ${appointment.status} appointment`);
      }
      
      // Handle rescheduling (changing time)
      if (updateData.startTime || updateData.endTime) {
        const newStartTime = updateData.startTime ? new Date(updateData.startTime) : appointment.startTime;
        const newEndTime = updateData.endTime ? new Date(updateData.endTime) : appointment.endTime;
        
        // Validate new times
        if (newEndTime <= newStartTime) {
          throw new ValidationError('End time must be after start time');
        }
        
        if (newStartTime < new Date()) {
          throw new ValidationError('Cannot reschedule to a past time');
        }
        
        // Check for overlapping appointments with new time
        const overlappingAppointment = await Appointment.findOne({
          doctorId: appointment.doctorId,
          _id: { $ne: appointmentId }, // Exclude current appointment
          status: { $nin: ['cancelled', 'no-show'] },
          $or: [
            { startTime: { $lt: newEndTime, $gte: newStartTime } },
            { endTime: { $gt: newStartTime, $lte: newEndTime } },
            { 
              startTime: { $lte: newStartTime },
              endTime: { $gte: newEndTime }
            }
          ]
        }).session(session);
        
        if (overlappingAppointment) {
          throw new BusinessLogicError('Doctor already has an appointment during this time');
        }
        
        // Update times
        appointment.startTime = newStartTime;
        appointment.endTime = newEndTime;
      }
      
      // Update other fields
      if (updateData.reason) {
        appointment.reason = updateData.reason;
      }
      
      if (updateData.notes) {
        appointment.notes = updateData.notes;
      }
      
      if (updateData.status) {
        // Status validation (may need more complex logic based on roles)
        const validStatusTransitions = {
          'scheduled': ['in-progress', 'cancelled', 'no-show'],
          'in-progress': ['completed', 'cancelled'],
          'pending': ['scheduled', 'cancelled']
        };
        
        const currentStatus = appointment.status;
        
        if (!validStatusTransitions[currentStatus]?.includes(updateData.status)) {
          throw new ValidationError(`Cannot change appointment status from ${currentStatus} to ${updateData.status}`);
        }
        
        appointment.status = updateData.status;
      }
      
      // Add update to audit trail
      appointment.auditTrail.push({
        action: 'updated',
        performedBy: userId,
        timestamp: new Date(),
        changes: updateData
      });
      
      // Save the updated appointment
      await appointment.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      return {
        id: appointment._id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        status: appointment.status,
        reason: appointment.reason,
        notes: appointment.notes,
        type: appointment.type,
        updatedAt: appointment.updatedAt
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Error updating appointment', { 
        error: error.message,
        appointmentId,
        updateData
      });
      throw error;
    }
  }
};
module.exports = appointmentService;
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

const appointmentService = {
  /**
   * Check if a time slot is available for booking
   * @param {string} doctorId - The doctor's ID
   * @param {Date} startTime - Start time of appointment
   * @param {Date} endTime - End time of appointment
   * @param {string} [excludeAppointmentId] - Optional appointment ID to exclude from conflict check (for rescheduling)
   * @returns {Promise<boolean>} True if the slot is available
   */
  checkAvailability: async (doctorId, startTime, endTime, excludeAppointmentId = null) => {
    try {
      // Check if the time slot falls within the doctor's working hours
      const isWithinWorkingHours = await scheduleService.isWithinWorkingHours(doctorId, startTime, endTime);
      if (!isWithinWorkingHours) {
        return false;
      }

      // Check if the doctor is not on leave during this period
      const isOnLeave = await availabilityService.isDoctorOnLeave(doctorId, startTime, endTime);
      if (isOnLeave) {
        return false;
      }

      // Build query to check for conflicting appointments
      const query = {
        doctor: doctorId,
        status: { $in: ['scheduled', 'rescheduled'] },
        $or: [
          // Appointment starts during the proposed time slot
          { startTime: { $lt: endTime, $gte: startTime } },
          // Appointment ends during the proposed time slot
          { endTime: { $gt: startTime, $lte: endTime } },
          // Appointment completely contains the proposed time slot
          { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
        ]
      };

      // If we're rescheduling, exclude the current appointment from conflict check
      if (excludeAppointmentId) {
        query._id = { $ne: excludeAppointmentId };
      }

      // Check for conflicting appointments
      const conflictingAppointments = await Appointment.countDocuments(query);
      
      // NEW: Also check if any slots are currently being held for waitlisted patients
      const heldSlots = await Waitlist.countDocuments({
        'heldSlot.doctorId': doctorId,
        'heldSlot.heldUntil': { $gt: new Date() },
        $or: [
          // Held slot starts during the proposed time
          { 'heldSlot.startTime': { $lt: endTime, $gte: startTime } },
          // Held slot ends during the proposed time
          { 'heldSlot.endTime': { $gt: startTime, $lte: endTime } },
          // Held slot completely contains the proposed time
          { 
            'heldSlot.startTime': { $lte: startTime }, 
            'heldSlot.endTime': { $gte: endTime } 
          }
        ]
      });
      
      return conflictingAppointments === 0 && heldSlots === 0;
    } catch (error) {
      logger.error('Error checking appointment availability', {
        error: error.message,
        doctorId,
        startTime,
        endTime
      });
      throw new AppointmentError('Failed to check appointment availability', 'AVAILABILITY_CHECK_FAILED');
    }
  },

  /**
   * Create a new appointment
   * @param {Object} appointmentData - The appointment data
   * @returns {Promise<Object>} The created appointment
   */
  createAppointment: async (appointmentData) => {
    try {
      // Check availability
      const isAvailable = await appointmentService.checkAvailability(
        appointmentData.doctor,
        appointmentData.startTime,
        appointmentData.endTime
      );
      
      if (!isAvailable) {
        throw new AppointmentError('The requested time slot is not available', 'SLOT_UNAVAILABLE');
      }
      
      // Create the appointment
      const appointment = new Appointment(appointmentData);
      await appointment.save();
      
      // Send confirmation notifications
      // This would be implemented in the notification service
      
      return appointment;
    } catch (error) {
      logger.error('Error creating appointment', {
        error: error.message,
        appointmentData
      });
      
      throw new AppointmentError(
        error.message || 'Failed to create appointment',
        error.code || 'APPOINTMENT_CREATION_FAILED'
      );
    }
  },

  /**
   * Check if a user is authorized to access an appointment
   * @param {string} userId - The user ID
   * @param {string} appointmentId - The appointment ID
   * @param {Array} allowedRoles - Roles that are allowed access
   * @returns {Promise<boolean>} True if the user is authorized
   */
  isUserAuthorizedForAppointment: async (userId, appointmentId, allowedRoles = []) => {
    try {
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        return false;
      }
      
      const user = await User.findById(userId).select('role');
      
      // Admin has full access
      if (user.role === 'admin' || allowedRoles.includes('admin')) {
        return true;
      }
      
      // Check if user is the patient or doctor for this appointment
      if (
        (appointment.patient.toString() === userId && allowedRoles.includes('patient')) ||
        (appointment.doctor.toString() === userId && allowedRoles.includes('doctor'))
      ) {
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error checking appointment authorization', {
        error: error.message,
        userId,
        appointmentId
      });
      return false;
    }
  },

  /**
   * Reschedule an appointment with drag-and-drop support
   * @param {string} appointmentId - The appointment ID
   * @param {Date} newStartTime - New start time
   * @param {Date} newEndTime - New end time
   * @param {string} reason - Reason for rescheduling
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} The updated appointment
   */
  rescheduleAppointment: async (appointmentId, newStartTime, newEndTime, reason, options = {}) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const appointment = await Appointment.findById(appointmentId).session(session);
      
      if (!appointment) {
        throw new AppointmentError('Appointment not found', 'APPOINTMENT_NOT_FOUND');
      }
      
      if (appointment.status === 'cancelled' || appointment.status === 'completed') {
        throw new AppointmentError('Cannot reschedule a cancelled or completed appointment', 'INVALID_APPOINTMENT_STATUS');
      }
      
      // Check if the new slot is available
      const isAvailable = await appointmentService.checkAvailability(
        appointment.doctor.toString(),
        newStartTime,
        newEndTime,
        appointmentId
      );
      
      if (!isAvailable) {
        throw new AppointmentError('The requested time slot is not available', 'SLOT_UNAVAILABLE');
      }
      
      // Store previous times for history tracking
      const previousStartTime = appointment.startTime;
      const previousEndTime = appointment.endTime;
      
      // Update the appointment
      appointment.previousStartTime = previousStartTime;
      appointment.previousEndTime = previousEndTime;
      appointment.startTime = newStartTime;
      appointment.endTime = newEndTime;
      appointment.status = 'rescheduled';
      appointment.rescheduleReason = reason;
      appointment.rescheduleDate = new Date();
      
      await appointment.save({ session });
      
      // Check if we need to auto-fill the freed slot
      if (options.checkWaitlist && moment(previousStartTime).isAfter(moment())) {
        await appointmentService.checkWaitlistForSlot(
          appointment.doctor.toString(),
          previousStartTime,
          previousEndTime,
          appointment.appointmentType.toString(),
          session
        );
      }
      
      // Send notifications
      await notificationService.sendAppointmentRescheduledNotification(appointment);
      
      await session.commitTransaction();
      session.endSession();
      
      return appointment;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Error rescheduling appointment', {
        error: error.message,
        appointmentId,
        newStartTime,
        newEndTime
      });
      
      throw new AppointmentError(
        error.message || 'Failed to reschedule appointment',
        error.code || 'RESCHEDULE_FAILED'
      );
    }
  },

  /**
   * Cancel an appointment with cancellation rule enforcement
   * @param {string} appointmentId - The appointment ID
   * @param {string} reason - Cancellation reason
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} The cancelled appointment
   */
  cancelAppointment: async (appointmentId, reason, options = {}) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const appointment = await Appointment.findById(appointmentId).session(session);
      
      if (!appointment) {
        throw new AppointmentError('Appointment not found', 'APPOINTMENT_NOT_FOUND');
      }
      
      if (appointment.status === 'cancelled' || appointment.status === 'completed') {
        throw new AppointmentError('Cannot cancel a cancelled or completed appointment', 'INVALID_APPOINTMENT_STATUS');
      }
      
      // Check cancellation rules unless it's an admin or force cancellation
      if (!options.forceCancel && !options.isAdmin) {
        if (!appointment.canCancel()) {
          throw new AppointmentError(
            'Cancellation not allowed due to cancellation policy',
            'CANCELLATION_POLICY_VIOLATION'
          );
        }
      }
      
      // Store previous data for reference
      const originalStartTime = appointment.startTime;
      const originalEndTime = appointment.endTime;
      const doctorId = appointment.doctor.toString();
      const appointmentTypeId = appointment.appointmentType.toString();
      
      // Update the appointment
      appointment.status = 'cancelled';
      appointment.notes = appointment.notes 
        ? `${appointment.notes}\n\nCancellation reason: ${reason}`
        : `Cancellation reason: ${reason}`;
      
      await appointment.save({ session });
      
      // Check if we need to auto-fill the freed slot from waitlist
      if (options.checkWaitlist && moment(originalStartTime).isAfter(moment())) {
        await appointmentService.checkWaitlistForSlot(
          doctorId,
          originalStartTime,
          originalEndTime,
          appointmentTypeId,
          session
        );
      }
      
      // Send notifications about cancellation
      await notificationService.sendAppointmentCancelledNotification(appointment);
      
      await session.commitTransaction();
      session.endSession();
      
      return appointment;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      logger.error('Error cancelling appointment', {
        error: error.message,
        appointmentId,
        reason
      });
      
      throw new AppointmentError(
        error.message || 'Failed to cancel appointment',
        error.code || 'CANCELLATION_FAILED'
      );
    }
  },

  /**
   * Check waitlist for patients who can fill a freed time slot
   * @param {string} doctorId - The doctor's ID
   * @param {Date} slotStartTime - Start time of the freed slot
   * @param {Date} slotEndTime - End time of the freed slot
   * @param {string} appointmentTypeId - Appointment type ID
   * @param {mongoose.ClientSession} [session] - Mongoose session for transaction
   * @returns {Promise<boolean>} True if slot was filled from waitlist
   */
  checkWaitlistForSlot: async (doctorId, slotStartTime, slotEndTime, appointmentTypeId, session = null) => {
    try {
      // Find suitable waitlist entries for this slot
      const slotDate = moment(slotStartTime).startOf('day').toDate();
      const slotTimeOfDay = getTimeOfDay(slotStartTime);
      
      // Query for patients on waitlist who could take this slot
      const waitlistEntries = await Waitlist.find({
        doctor: doctorId,
        appointmentType: appointmentTypeId,
        status: 'active',
        dateRangeStart: { $lte: slotStartTime },
        dateRangeEnd: { $gte: slotEndTime },
        $or: [
          { preferredTimeOfDay: slotTimeOfDay },
          { preferredTimeOfDay: 'any' }
        ],
        // NEW: Ensure the waitlist entry doesn't already have a held slot
        heldSlot: null
      })
      .sort({ priority: -1, createdAt: 1 })
      .session(session || null)
      .populate('patient')
      .limit(5); // Get top 5 candidates
      
      if (waitlistEntries.length === 0) {
        return false;
      }
      
      // Try to automatically assign to patients with autoAccept enabled
      for (const entry of waitlistEntries) {
        if (entry.autoAccept) {
          // Create new appointment from waitlist entry
          const newAppointment = new Appointment({
            patient: entry.patient._id,
            doctor: doctorId,
            appointmentType: appointmentTypeId,
            startTime: slotStartTime,
            endTime: slotEndTime,
            status: 'scheduled',
            filledFromWaitlist: true,
            notes: `Auto-filled from waitlist entry created on ${moment(entry.createdAt).format('MMM DD, YYYY')}`
          });
          
          await newAppointment.save({ session: session || null });
          
          // Update waitlist entry
          entry.status = 'fulfilled';
          entry.offeredAppointments.push({
            appointmentId: newAppointment._id,
            doctorId: doctorId,
            startTime: slotStartTime,
            endTime: slotEndTime,
            offeredAt: new Date(),
            status: 'accepted'
          });
          
          await entry.save({ session: session || null });
          
          // Send notification
          await notificationService.sendWaitlistAppointmentCreatedNotification(newAppointment, entry);
          
          return true;
        }
      }
      
      // If no auto-accept, offer the slot to the top priority patient
      // UPDATED: This now uses the notifyWaitlistPatientAboutSlot function
      const topEntry = waitlistEntries[0];
      
      // Create a unique slot ID
      const slotId = `slot-${doctorId}-${Date.now()}`;
      
      // Notify the patient about the available slot
      await notificationService.notifyWaitlistPatientAboutSlot(
        topEntry._id,
        {
          doctorId,
          startTime: slotStartTime,
          endTime: slotEndTime,
          slotId,
          appointmentTypeId
        },
        {
          responseTimeMinutes: config.WAITLIST_RESPONSE_TIME_MINUTES || 120
        }
      );
      
      return true; // We've successfully notified a patient
    } catch (error) {
      logger.error('Error checking waitlist for slot', {
        error: error.message,
        doctorId,
        slotStartTime,
        slotEndTime
      });
      return false;
    }
  },

  /**
   * Set cancellation rules for a doctor
   * @param {string} doctorId - The doctor's ID
   * @param {string} defaultRule - Default cancellation rule
   * @param {number} customHours - Custom cancellation hours if rule is 'custom'
   * @returns {Promise<Object>} The updated doctor settings
   */
  setDoctorCancellationRules: async (doctorId, defaultRule, customHours = null) => {
    try {
      // This would update a doctor's settings document
      const doctorSettings = await DoctorSettings.findOne({ doctor: doctorId });
      
      if (!doctorSettings) {
        throw new AppointmentError('Doctor settings not found', 'SETTINGS_NOT_FOUND');
      }
      
      doctorSettings.cancellationRule = defaultRule;
      
      if (defaultRule === 'custom' && customHours !== null) {
        doctorSettings.customCancellationHours = customHours;
      }
      
      await doctorSettings.save();
      return doctorSettings;
    } catch (error) {
      logger.error('Error setting doctor cancellation rules', {
        error: error.message,
        doctorId,
        defaultRule,
        customHours
      });
      throw new AppointmentError('Failed to set cancellation rules', 'SETTINGS_UPDATE_FAILED');
    }
  }
};

/**
 * Helper function to determine time of day
 * @param {Date} date - The date to check
 * @returns {string} Time of day category
 */
function getTimeOfDay(date) {
  const hour = moment(date).hour();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

module.exports = appointmentService;
// src/services/appointment.service.js
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Appointment = require('../models/appointment.model');
const Patient = require('../models/patient.model');
const Doctor = require('../models/doctor.model');
const emailService = require('./email.service');

const appointmentService = {
  /**
   * Create a new appointment
   * @param {Object} appointmentData - Appointment details
   * @returns {Promise<Object>} Created appointment
   */
  createAppointment: async (appointmentData) => {
    try {
      const { patientId, doctorId, startTime, endTime, type, reason } = appointmentData;
      
      // Validate patient and doctor exist
      const [patient, doctor] = await Promise.all([
        Patient.findById(patientId),
        Doctor.findById(doctorId)
      ]);
      
      if (!patient || !doctor) {
        throw new Error('Patient or doctor not found');
      }
      
      // Check for conflicts
      const patientHasConflict = await patient.hasAppointmentConflict(startTime, endTime);
      const doctorIsAvailable = await Appointment.checkDoctorAvailability(doctorId, startTime, endTime);
      
      if (patientHasConflict) {
        throw new Error('Patient has a conflicting appointment during this time');
      }
      
      if (!doctorIsAvailable) {
        throw new Error('Doctor is not available during this time slot');
      }
      
      // Create the appointment
      const appointment = new Appointment({
        patient: patientId,
        doctor: doctorId,
        startTime,
        endTime,
        type,
        reason,
        selfScheduled: appointmentData.selfScheduled || false,
        notifyPatient: appointmentData.notifyPatient !== false // Default to true
      });
      
      await appointment.save();
      
      // Add to patient's history
      await patient.addToAppointmentHistory(appointment._id, 'scheduled');
      
      // Send notification if requested
      if (appointment.notifyPatient) {
        await appointmentService.sendAppointmentNotification(appointment._id, 'created');
      }
      
      logger.info(`Appointment created successfully`, { 
        appointmentId: appointment._id, 
        patientId, 
        doctorId 
      });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to create appointment', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Reschedule an existing appointment
   * @param {string} appointmentId - ID of the appointment to reschedule
   * @param {Object} updateData - New appointment details
   * @returns {Promise<Object>} Updated appointment
   */
  rescheduleAppointment: async (appointmentId, updateData) => {
    try {
      const appointment = await Appointment.findById(appointmentId).exec();
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      if (appointment.status !== 'scheduled') {
        throw new Error(`Cannot reschedule appointment with status: ${appointment.status}`);
      }
      
      const { startTime, endTime, doctorId } = updateData;
      
      // If doctor is changing, verify the new doctor exists
      let doctor = appointment.doctor;
      if (doctorId && doctorId !== appointment.doctor.toString()) {
        doctor = await Doctor.findById(doctorId);
        if (!doctor) {
          throw new Error('New doctor not found');
        }
      }
      
      // Check for conflicts
      const patient = await Patient.findById(appointment.patient);
      
      if (startTime && endTime) {
        const newStartTime = startTime || appointment.startTime;
        const newEndTime = endTime || appointment.endTime;
        
        const patientHasConflict = await patient.hasAppointmentConflict(
          newStartTime, 
          newEndTime, 
          appointmentId
        );
        
        const doctorIsAvailable = await Appointment.checkDoctorAvailability(
          doctorId || appointment.doctor,
          newStartTime,
          newEndTime,
          appointmentId
        );
        
        if (patientHasConflict) {
          throw new Error('Patient has a conflicting appointment during this time');
        }
        
        if (!doctorIsAvailable) {
          throw new Error('Doctor is not available during this time slot');
        }
      }
      
      // Update the appointment
      Object.keys(updateData).forEach(key => {
        if (['startTime', 'endTime', 'doctorId', 'reason', 'type', 'notes'].includes(key)) {
          if (key === 'doctorId') {
            appointment.doctor = updateData[key];
          } else {
            appointment[key] = updateData[key];
          }
        }
      });
      
      await appointment.save();
      
      // Send notification
      await appointmentService.sendAppointmentNotification(appointmentId, 'rescheduled');
      
      logger.info(`Appointment rescheduled successfully`, { appointmentId });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to reschedule appointment', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  },
  
  /**
   * Cancel an appointment
   * @param {string} appointmentId - ID of appointment to cancel
   * @param {Object} cancellationData - Cancellation details
   * @returns {Promise<Object>} Cancelled appointment
   */
  cancelAppointment: async (appointmentId, cancellationData) => {
    try {
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      if (appointment.status !== 'scheduled') {
        throw new Error(`Cannot cancel appointment with status: ${appointment.status}`);
      }
      
      // Update appointment
      appointment.status = 'cancelled';
      appointment.cancellationReason = cancellationData.reason || 'No reason provided';
      appointment.cancelledBy = cancellationData.cancelledBy || 'patient';
      appointment.cancellationTime = new Date();
      
      await appointment.save();
      
      // Update patient history
      const patient = await Patient.findById(appointment.patient);
      await patient.addToAppointmentHistory(appointment._id, 'cancelled');
      
      // Send notification
      await appointmentService.sendAppointmentNotification(appointmentId, 'cancelled');
      
      logger.info(`Appointment cancelled successfully`, { 
        appointmentId,
        cancelledBy: appointment.cancelledBy 
      });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to cancel appointment', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  },
  
  /**
   * Mark patient as checked in for appointment
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Updated appointment
   */
  checkInPatient: async (appointmentId) => {
    try {
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      if (appointment.status !== 'scheduled') {
        throw new Error(`Cannot check in appointment with status: ${appointment.status}`);
      }
      
      appointment.status = 'checked_in';
      appointment.checkinTime = new Date();
      
      await appointment.save();
      
      logger.info(`Patient checked in for appointment`, { appointmentId });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to check in patient', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  },
  
  /**
   * Mark appointment as completed
   * @param {string} appointmentId - Appointment ID
   * @param {Object} completionData - Completion details
   * @returns {Promise<Object>} Updated appointment
   */
  completeAppointment: async (appointmentId, completionData) => {
    try {
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      if (!['checked_in', 'in_progress'].includes(appointment.status)) {
        throw new Error(`Cannot complete appointment with status: ${appointment.status}`);
      }
      
      // Update appointment
      appointment.status = 'completed';
      appointment.completionTime = new Date();
      appointment.notes = completionData.notes || appointment.notes;
      
      if (completionData.followUp) {
        appointment.followUpRecommendation = {
          recommended: true,
          timeframe: completionData.followUp.timeframe
        };
      }
      
      await appointment.save();
      
      // Update patient history
      const patient = await Patient.findById(appointment.patient);
      await patient.addToAppointmentHistory(appointment._id, 'completed');
      
      logger.info(`Appointment marked as completed`, { appointmentId });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to complete appointment', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  },
  
  /**
   * Mark appointment as no-show
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Updated appointment
   */
  markNoShow: async (appointmentId) => {
    try {
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      if (appointment.status !== 'scheduled') {
        throw new Error(`Cannot mark no-show for appointment with status: ${appointment.status}`);
      }
      
      // Get current time
      const now = new Date();
      const appointmentStartTime = new Date(appointment.startTime);
      const fifteenMinutesAfterStart = new Date(appointmentStartTime.getTime() + 15 * 60000);
      
      // Only allow no-show marking 15 minutes after appointment start time
      if (now < fifteenMinutesAfterStart) {
        throw new Error('Cannot mark as no-show until 15 minutes after scheduled start time');
      }
      
      // Update appointment
      appointment.status = 'no_show';
      
      await appointment.save();
      
      // Update patient history and increment no-show count
      const patient = await Patient.findById(appointment.patient);
      await patient.addToAppointmentHistory(appointment._id, 'no_show');
      
      logger.info(`Appointment marked as no-show`, { appointmentId });
      
      return appointment;
    } catch (error) {
      logger.error('Failed to mark appointment as no-show', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  },
  
  /**
   * Find available time slots for a doctor
   * @param {string} doctorId - Doctor ID
   * @param {Date} date - Date to check
   * @returns {Promise<Array>} List of available time slots
   */
  findAvailableTimeSlots: async (doctorId, date) => {
    try {
      const doctor = await Doctor.findById(doctorId);
      
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Get doctor's schedule for the day of week
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const schedule = doctor.availability.find(a => a.dayOfWeek === dayOfWeek);
      
      if (!schedule || !schedule.available) {
        return [];
      }
      
      // Parse working hours
      const startHour = parseInt(schedule.startTime.split(':')[0]);
      const startMinute = parseInt(schedule.startTime.split(':')[1]);
      const endHour = parseInt(schedule.endTime.split(':')[0]);
      const endMinute = parseInt(schedule.endTime.split(':')[1]);
      
      // Set date to midnight of the requested date
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      // Set working hours start and end times
      const workingStartTime = new Date(startDate);
      workingStartTime.setHours(startHour, startMinute, 0, 0);
      
      const workingEndTime = new Date(startDate);
      workingEndTime.setHours(endHour, endMinute, 0, 0);
      
      // Define appointment duration (default 30 minutes)
      const appointmentDuration = doctor.defaultAppointmentDuration || 30;
      
      // Get all appointments for the doctor on this day
      const appointments = await Appointment.find({
        doctor: doctorId,
        status: 'scheduled',
        startTime: { $gte: startDate },
        endTime: { $lt: new Date(startDate.getTime() + 24 * 60 * 60 * 1000) }
      }).sort('startTime').exec();
      
      // Generate all possible time slots
      const timeSlots = [];
      let currentSlotStart = new Date(workingStartTime);
      
      while (currentSlotStart.getTime() + appointmentDuration * 60 * 1000 <= workingEndTime.getTime()) {
        const slotEnd = new Date(currentSlotStart.getTime() + appointmentDuration * 60 * 1000);
        
        // Check if this slot conflicts with any appointments
        const hasConflict = appointments.some(appointment => {
          const appointmentStart = new Date(appointment.startTime);
          const appointmentEnd = new Date(appointment.endTime);
          
          return (
            (currentSlotStart < appointmentEnd && slotEnd > appointmentStart) ||  
            (currentSlotStart.getTime() === appointmentStart.getTime() && slotEnd.getTime() === appointmentEnd.getTime())
          );
        });
        
        if (!hasConflict) {
          timeSlots.push({
            startTime: new Date(currentSlotStart),
            endTime: new Date(slotEnd)
          });
        }
        
        // Move to next slot (typically 30 min increments)
        currentSlotStart = new Date(currentSlotStart.getTime() + appointmentDuration * 60 * 1000);
      }
      
      return timeSlots;
    } catch (error) {
      logger.error('Failed to find available time slots', { 
        error: error.message,
        doctorId,
        date 
      });
      throw error;
    }
  },
  
  /**
   * Get appointment details by ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Appointment details
   */
  getAppointmentById: async (appointmentId) => {
    try {
      const appointment = await Appointment.findById(appointmentId)
        .populate('patient', 'user contactNumber')
        .populate({
          path: 'patient',
          populate: {
            path: 'user',
            select: 'firstName lastName email'
          }
        })
        .populate('doctor', 'user specialty')
        .populate({
          path: 'doctor',
          populate: {
            path: 'user',
            select: 'firstName lastName email'
          }
        });
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      return appointment;
    } catch (error) {
      logger.error('Failed to retrieve appointment', { 
        error: error.message,
        appointmentId 
      });
      throw error;
    }
  },
  
  /**
   * Get patient's appointment history
   * @param {string} patientId - Patient ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of appointments
   */
  getPatientAppointments: async (patientId, filters = {}) => {
    try {
      const query = { patient: patientId };
      
      // Apply status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Apply date range filters if provided
      if (filters.startDate) {
        query.startTime = { $gte: new Date(filters.startDate) };
      }
      
      if (filters.endDate) {
        query.endTime = { ...query.endTime, $lte: new Date(filters.endDate) };
      }
      
      const appointments = await Appointment.find(query)
        .populate('doctor', 'user specialty')
        .populate({
          path: 'doctor',
          populate: {
            path: 'user',
            select: 'firstName lastName'
          }
        })
        .sort({ startTime: filters.sort === 'asc' ? 1 : -1 })
        .exec();
      
      return appointments;
    } catch (error) {
      logger.error('Failed to retrieve patient appointments', { 
        error: error.message,
        patientId 
      });
      throw error;
    }
  },
  
  /**
   * Get doctor's appointment schedule
   * @param {string} doctorId - Doctor ID
   * @param {Object} filters - Filters like date range
   * @returns {Promise<Array>} List of appointments
   */
  getDoctorSchedule: async (doctorId, filters = {}) => {
    try {
      const query = { doctor: doctorId };
      
      // Apply status filter if provided
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Apply date range filters
      if (filters.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query.startTime = { $gte: startOfDay, $lte: endOfDay };
      } else {
        if (filters.startDate) {
          query.startTime = { $gte: new Date(filters.startDate) };
        }
        
        if (filters.endDate) {
          query.endTime = { ...query.endTime, $lte: new Date(filters.endDate) };
        }
      }
      
      const appointments = await Appointment.find(query)
        .populate('patient', 'user contactNumber')
        .populate({
          path: 'patient',
          populate: {
            path: 'user',
            select: 'firstName lastName'
          }
        })
        .sort('startTime')
        .exec();
      
      return appointments;
    } catch (error) {
      logger.error('Failed to retrieve doctor schedule', { 
        error: error.message,
        doctorId 
      });
      throw error;
    }
  },
  
  /**
   * Send notification about appointment
   * @param {string} appointmentId - Appointment ID
   * @param {string} notificationType - Type of notification
   * @returns {Promise<Object>} Notification result
   */
  sendAppointmentNotification: async (appointmentId, notificationType) => {
    try {
      const appointment = await Appointment.findById(appointmentId)
        .populate('patient')
        .populate({
          path: 'patient',
          populate: {
            path: 'user',
            select: 'email firstName lastName'
          }
        })
        .populate({
          path: 'doctor',
          populate: {
            path: 'user',
            select: 'firstName lastName'
          }
        });
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      // Only proceed if patient wants notifications for appointments
      if (!appointment.patient.communicationPreferences?.appointmentReminders?.email) {
        logger.info('Skipping email notification as patient has disabled email reminders', 
          { appointmentId }
        );
        return { skipped: true };
      }
      
      const patientEmail = appointment.patient.user.email;
      const patientName = `${appointment.patient.user.firstName} ${appointment.patient.user.lastName}`;
      const doctorName = `Dr. ${appointment.doctor.user.lastName}`;
      const appointmentDate = appointment.startTime.toLocaleDateString();
      const appointmentTime = appointment.startTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      let subject, message;
      
      switch (notificationType) {
        case 'created':
          subject = 'Appointment Confirmation';
          message = `Dear ${patientName},\n\nYour appointment with ${doctorName} has been scheduled for ${appointmentDate} at ${appointmentTime}.\n\nPlease arrive 15 minutes before your appointment time.`;
          break;
        case 'reminder':
          subject = 'Appointment Reminder';
          message = `Dear ${patientName},\n\nThis is a reminder that you have an appointment with ${doctorName} on ${appointmentDate} at ${appointmentTime}.\n\nPlease arrive 15 minutes before your appointment time.`;
          break;
        case 'rescheduled':
          subject = 'Appointment Rescheduled';
          message = `Dear ${patientName},\n\nYour appointment with ${doctorName} has been rescheduled to ${appointmentDate} at ${appointmentTime}.\n\nPlease let us know if this time doesn't work for you.`;
          break;
        case 'cancelled':
          subject = 'Appointment Cancelled';
          message = `Dear ${patientName},\n\nYour appointment with ${doctorName} on ${appointmentDate} at ${appointmentTime} has been cancelled.\n\nPlease contact our office if you would like to reschedule.`;
          break;
        default:
          subject = 'Appointment Update';
          message = `Dear ${patientName},\n\nThere has been an update to your appointment with ${doctorName} on ${appointmentDate} at ${appointmentTime}.\n\nPlease check your patient portal for details.`;
      }
      
      // Store the notification attempt
      appointment.remindersSent.push({
        type: 'email',
        sentAt: new Date(),
        status: 'sent' // Assume success; in real implementation, this would be updated based on the email service response
      });
      
      await appointment.save();
      
      // In a real implementation, this would use emailService to send the email
      logger.info(`MOCK EMAIL: ${subject} for ${patientEmail}`, {
        appointmentId,
        notificationType
      });
      
      // Example: In production, you'd use your email service
      // return await emailService.sendAppointmentEmail(patientEmail, subject, message);
      
      // Return mock success for development
      return {
        success: true,
        message: `${notificationType} notification sent to ${patientEmail}`
      };
    } catch (error) {
      logger.error('Failed to send appointment notification', { 
        error: error.message,
        appointmentId,
        notificationType 
      });
      throw error;
    }
  },
  
  /**
   * Schedule appointment reminders for the upcoming appointments
   * @returns {Promise<Object>} Result of scheduled reminders
   */
  scheduleAppointmentReminders: async () => {
    try {
      // Get all appointments in next 24 hours that haven't had a reminder sent
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      
      const appointments = await Appointment.find({
        status: 'scheduled',
        startTime: { $gte: new Date(), $lte: tomorrow },
        remindersSent: { 
          $not: { 
            $elemMatch: { 
              type: 'email', 
              sentAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
            } 
          } 
        }
      }).populate('patient').exec();
      
      logger.info(`Found ${appointments.length} appointments needing reminders in the next 24 hours`);
      
      // Send reminders
      const results = await Promise.all(
        appointments.map(appointment => 
          appointmentService.sendAppointmentNotification(appointment._id, 'reminder')
        )
      );
      
      return {
        success: true,
        totalReminders: appointments.length,
        remindersSent: results.filter(r => r.success).length,
        remindersSkipped: results.filter(r => r.skipped).length
      };
    } catch (error) {
      logger.error('Failed to schedule appointment reminders', { 
        error: error.message 
      });
      throw error;
    }
  },
  
  /**
   * Update patient scheduling preferences
   * @param {string} patientId - Patient ID
   * @param {Object} preferences - Scheduling preferences
   * @returns {Promise<Object>} Updated patient
   */
  updatePatientSchedulingPreferences: async (patientId, preferences) => {
    try {
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      // Update preferred doctors if provided
      if (preferences.preferredDoctors) {
        // Validate all doctor IDs exist
        for (const doctorId of preferences.preferredDoctors) {
          const doctorExists = await Doctor.exists({ _id: doctorId });
          if (!doctorExists) {
            throw new Error(`Doctor with ID ${doctorId} not found`);
          }
        }
        
        patient.preferredDoctors = preferences.preferredDoctors;
      }
      
      // Update preferred time slots if provided
      if (preferences.preferredTimeSlots) {
        patient.preferredTimeSlots = preferences.preferredTimeSlots.map(slot => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime
        }));
      }
      
      // Update communication preferences if provided
      if (preferences.communicationPreferences) {
        patient.communicationPreferences = {
          ...patient.communicationPreferences,
          ...preferences.communicationPreferences
        };
      }
      
      await patient.save();
      
      logger.info(`Updated scheduling preferences for patient`, { patientId });
      
      return patient;
    } catch (error) {
      logger.error('Failed to update patient scheduling preferences', { 
        error: error.message,
        patientId 
      });
      throw error;
    }
  }
};

module.exports = appointmentService;
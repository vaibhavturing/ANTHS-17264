const config = require('../config/config');
const emailService = require('./email.service');
const User = require('../models/user.model');
const Waitlist = require('../models/waitlist.model');
const logger = require('../utils/logger');
const moment = require('moment');

// This would typically be replaced with a real SMS provider like Twilio
const mockSmsService = {
  sendSms: async (phoneNumber, message) => {
    logger.info(`MOCK SMS to ${phoneNumber}: ${message}`);
    return { success: true, sid: 'mock-sid-' + Date.now() };
  }
};

/**
 * Notification service for sending various types of notifications
 */
const notificationService = {
  /**
   * Notify a waitlisted patient about an available slot
   * @param {string} waitlistEntryId - ID of the waitlist entry
   * @param {Object} slot - Available slot details { doctorId, startTime, endTime, slotId }
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Notification results
   */
  notifyWaitlistPatientAboutSlot: async (waitlistEntryId, slot, options = {}) => {
    try {
      // Get waitlist entry with patient details
      const waitlistEntry = await Waitlist.findById(waitlistEntryId)
        .populate({
          path: 'patient',
          select: 'firstName lastName email phoneNumber'
        })
        .populate({
          path: 'doctor',
          select: 'firstName lastName'
        })
        .populate({
          path: 'appointmentType',
          select: 'name duration'
        });

      if (!waitlistEntry) {
        logger.error('Waitlist entry not found', { waitlistEntryId });
        throw new Error('Waitlist entry not found');
      }
      
      if (waitlistEntry.status !== 'active') {
        logger.warn('Attempted to notify inactive waitlist entry', { 
          waitlistEntryId, 
          status: waitlistEntry.status 
        });
        throw new Error('Cannot notify inactive waitlist entry');
      }

      const patient = waitlistEntry.patient;
      const doctor = waitlistEntry.doctor;
      const appointmentType = waitlistEntry.appointmentType;
      
      if (!patient || !doctor || !appointmentType) {
        logger.error('Missing reference data in waitlist entry', { waitlistEntryId });
        throw new Error('Waitlist entry has missing reference data');
      }

      // Set response deadline - default 2 hours
      const responseTimeMinutes = options.responseTimeMinutes || config.WAITLIST_RESPONSE_TIME_MINUTES || 120;
      const respondBy = moment().add(responseTimeMinutes, 'minutes').toDate();

      // Update waitlist entry with offered slot info
      const offeredSlot = {
        doctorId: doctor._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        offeredAt: new Date(),
        respondBy,
        notificationSent: {
          email: { sent: false },
          sms: { sent: false }
        },
        status: 'pending'
      };

      // Update waitlist entry to hold the slot
      waitlistEntry.heldSlot = {
        slotId: slot.slotId || String(new Date().getTime()),
        doctorId: doctor._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        heldUntil: respondBy,
        appointmentTypeId: appointmentType._id
      };

      waitlistEntry.notificationCount += 1;
      waitlistEntry.lastNotified = new Date();
      waitlistEntry.offeredAppointments.push(offeredSlot);

      await waitlistEntry.save();

      // Generate accept/reject links
      const baseUrl = config.FRONTEND_URL;
      const acceptUrl = `${baseUrl}/waitlist/accept?id=${waitlistEntry._id}&slot=${waitlistEntry.heldSlot.slotId}`;
      const rejectUrl = `${baseUrl}/waitlist/reject?id=${waitlistEntry._id}&slot=${waitlistEntry.heldSlot.slotId}`;

      // Send email notification
      const notificationResults = { email: null, sms: null };
      
      if (waitlistEntry.contactPreferences.email || waitlistEntry.contactPreferences.preferredMethod === 'both') {
        try {
          const emailResult = await emailService.sendWaitlistSlotNotification(
            patient.email,
            {
              patientName: `${patient.firstName} ${patient.lastName}`,
              doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
              appointmentType: appointmentType.name,
              startTime: moment(slot.startTime).format('dddd, MMMM D, YYYY h:mm A'),
              endTime: moment(slot.endTime).format('h:mm A'),
              respondBy: moment(respondBy).format('dddd, MMMM D, h:mm A'),
              acceptUrl,
              rejectUrl
            }
          );

          // Update notification status
          const emailIndex = waitlistEntry.offeredAppointments.length - 1;
          waitlistEntry.offeredAppointments[emailIndex].notificationSent.email = {
            sent: true,
            sentAt: new Date(),
            deliveryStatus: 'sent'
          };
          
          notificationResults.email = emailResult;
        } catch (error) {
          logger.error('Failed to send waitlist email notification', {
            error: error.message,
            waitlistEntryId,
            patientEmail: patient.email
          });
        }
      }

      // Send SMS notification
      if (waitlistEntry.contactPreferences.sms || waitlistEntry.contactPreferences.preferredMethod === 'both') {
        const phoneNumber = waitlistEntry.phoneNumber || patient.phoneNumber;
        
        if (phoneNumber) {
          try {
            const message = `Healthcare App: An appointment slot is available with Dr. ${doctor.lastName} on ${moment(slot.startTime).format('MMM D')} at ${moment(slot.startTime).format('h:mm A')}. Respond by ${moment(respondBy).format('h:mm A')}. Accept: ${acceptUrl} or Decline: ${rejectUrl}`;
            
            const smsResult = await mockSmsService.sendSms(phoneNumber, message);
            
            // Update notification status
            const smsIndex = waitlistEntry.offeredAppointments.length - 1;
            waitlistEntry.offeredAppointments[smsIndex].notificationSent.sms = {
              sent: true,
              sentAt: new Date(),
              deliveryStatus: 'sent'
            };
            
            notificationResults.sms = smsResult;
          } catch (error) {
            logger.error('Failed to send waitlist SMS notification', {
              error: error.message,
              waitlistEntryId,
              phoneNumber
            });
          }
        }
      }

      // Save the updated notification statuses
      await waitlistEntry.save();

      // Set up a job to check for response timeout
      // In a production app, this would be handled by a job queue like Bull
      if (config.NODE_ENV === 'production') {
        // Add to job queue
        // Example: await waitlistQueue.add('checkResponseTimeout', { waitlistEntryId }, { delay: responseTimeMinutes * 60 * 1000 });
      }

      return {
        success: true,
        waitlistEntry,
        notificationResults
      };
    } catch (error) {
      logger.error('Failed to notify waitlist patient', {
        error: error.message,
        waitlistEntryId,
        slot
      });
      throw error;
    }
  },

  /**
   * Process a waitlist entry's response to an offered slot
   * @param {string} waitlistEntryId - ID of the waitlist entry
   * @param {string} slotId - ID of the offered slot
   * @param {string} response - 'accept' or 'decline'
   * @returns {Promise<Object>} Processing result
   */
  processWaitlistResponse: async (waitlistEntryId, slotId, response) => {
    try {
      const waitlistEntry = await Waitlist.findById(waitlistEntryId);
      
      if (!waitlistEntry) {
        throw new Error('Waitlist entry not found');
      }
      
      // Verify this waitlist entry has this slot on hold
      if (!waitlistEntry.heldSlot || waitlistEntry.heldSlot.slotId !== slotId) {
        throw new Error('Slot not found or no longer held');
      }
      
      // Check if the hold has expired
      if (new Date() > new Date(waitlistEntry.heldSlot.heldUntil)) {
        throw new Error('Slot hold has expired');
      }
      
      // Find the offered appointment entry
      const offeredAppointmentIndex = waitlistEntry.offeredAppointments.findIndex(
        offer => offer.status === 'pending'
      );
      
      if (offeredAppointmentIndex === -1) {
        throw new Error('No pending offered appointments found');
      }
      
      // Process the response
      if (response === 'accept') {
        // Create an actual appointment
        const appointmentService = require('./appointment.service');
        
        const appointmentData = {
          patient: waitlistEntry.patient,
          doctor: waitlistEntry.doctor,
          appointmentType: waitlistEntry.appointmentType,
          startTime: waitlistEntry.heldSlot.startTime,
          endTime: waitlistEntry.heldSlot.endTime,
          status: 'scheduled',
          notes: `Created from waitlist entry ${waitlistEntryId}`
        };
        
        const appointment = await appointmentService.createAppointment(appointmentData);
        
        // Update waitlist entry
        waitlistEntry.status = 'fulfilled';
        waitlistEntry.offeredAppointments[offeredAppointmentIndex].status = 'accepted';
        waitlistEntry.offeredAppointments[offeredAppointmentIndex].appointmentId = appointment._id;
        
        // Clear the held slot
        waitlistEntry.heldSlot = null;
        
        await waitlistEntry.save();
        
        // Send confirmation notification
        await emailService.sendWaitlistConfirmation(
          waitlistEntry.patient.email,
          {
            appointmentId: appointment._id,
            appointmentDate: moment(appointment.startTime).format('dddd, MMMM D, YYYY'),
            appointmentTime: moment(appointment.startTime).format('h:mm A'),
            doctorName: `Dr. ${waitlistEntry.doctor.firstName} ${waitlistEntry.doctor.lastName}`
          }
        );
        
        return {
          success: true,
          message: 'Appointment successfully created',
          appointment,
          waitlistEntry
        };
      } else if (response === 'decline') {
        // Update waitlist entry but keep it active
        waitlistEntry.offeredAppointments[offeredAppointmentIndex].status = 'declined';
        
        // Clear the held slot
        waitlistEntry.heldSlot = null;
        
        await waitlistEntry.save();
        
        // Find the next eligible patient in the waitlist
        // Note: This would be handled by the appointmentService.checkWaitlistForSlot in a real implementation
        
        return {
          success: true,
          message: 'Slot offer declined',
          waitlistEntry
        };
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      logger.error('Error processing waitlist response', {
        error: error.message,
        waitlistEntryId,
        slotId,
        response
      });
      throw error;
    }
  },

  /**
   * Handle expired waitlist slot holds
   * @param {string} waitlistEntryId - ID of the waitlist entry
   * @returns {Promise<Object>} Processing result
   */
  handleExpiredSlotHold: async (waitlistEntryId) => {
    try {
      const waitlistEntry = await Waitlist.findById(waitlistEntryId);
      
      if (!waitlistEntry || !waitlistEntry.heldSlot) {
        return { success: true, message: 'No active hold to expire' };
      }
      
      // Check if hold has actually expired
      if (new Date() < new Date(waitlistEntry.heldSlot.heldUntil)) {
        return { success: true, message: 'Hold has not expired yet' };
      }
      
      // Find the pending offered appointment
      const offeredAppointmentIndex = waitlistEntry.offeredAppointments.findIndex(
        offer => offer.status === 'pending'
      );
      
      if (offeredAppointmentIndex !== -1) {
        waitlistEntry.offeredAppointments[offeredAppointmentIndex].status = 'expired';
      }
      
      // Clear the held slot
      const slotInfo = { ...waitlistEntry.heldSlot };
      waitlistEntry.heldSlot = null;
      
      await waitlistEntry.save();
      
      // Offer the slot to the next eligible patient
      const appointmentService = require('./appointment.service');
      await appointmentService.checkWaitlistForSlot(
        slotInfo.doctorId,
        slotInfo.startTime,
        slotInfo.endTime,
        slotInfo.appointmentTypeId
      );
      
      return {
        success: true,
        message: 'Expired slot hold processed successfully',
      };
    } catch (error) {
      logger.error('Error handling expired waitlist slot', {
        error: error.message,
        waitlistEntryId
      });
      throw error;
    }
  }
};

module.exports = notificationService;
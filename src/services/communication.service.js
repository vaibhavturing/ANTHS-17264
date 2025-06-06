// src/services/communication.service.js

const { 
  Communication, 
  CommunicationPreference, 
  COMMUNICATION_TYPES, 
  COMMUNICATION_CHANNELS, 
  DELIVERY_STATUS 
} = require('../models/communication.model');
const { Notification } = require('../models/notification.model');
const emailService = require('./email.service');
const logger = require('../utils/logger');
const config = require('../config/config');
const mongoose = require('mongoose');
const { NotFoundError, ValidationError, BusinessLogicError } = require('../utils/errors');

/**
 * Communication Service
 * Handles creation and delivery of patient communications
 */
const communicationService = {
  /**
   * Get patient's communication preferences
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Communication preferences
   */
  getPatientCommunicationPreferences: async (patientId) => {
    try {
      return await CommunicationPreference.findOne({ patient: patientId });
    } catch (error) {
      logger.error('Error retrieving communication preferences', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },

  /**
   * Create and send communication to a patient
   * @param {Object} data - Communication data
   * @returns {Promise<Object>} Created communication
   */
  createCommunication: async (data) => {
    try {
      // Get patient's communication preferences
      const preferences = await CommunicationPreference.findOne({ patient: data.patient });
      
      if (!preferences) {
        logger.warn(`No communication preferences found for patient ${data.patient}`, {
          patientId: data.patient
        });
        
        // Create default preferences
        await communicationService.createDefaultPreferences(data.patient);
      }
      
      // Determine which channels to use based on preferences or specified channels
      const channels = data.channels || 
        (preferences?.channelPreferences[data.type]?.channels || [COMMUNICATION_CHANNELS.EMAIL]);
      
      // Create delivery tracking entries for each channel
      const deliveryTracking = channels.map(channel => ({
        channel,
        status: data.scheduledFor ? DELIVERY_STATUS.SCHEDULED : DELIVERY_STATUS.PENDING,
      }));
      
      // Create the communication record
      const communication = new Communication({
        ...data,
        channels,
        deliveryTracking,
      });
      
      await communication.save();
      
      logger.info(`Communication created for patient ${data.patient}`, {
        communicationId: communication._id,
        type: data.type,
        channels
      });
      
      // If not scheduled for future, send immediately
      if (!data.scheduledFor) {
        await communicationService.sendCommunication(communication._id);
      }
      
      return communication;
    } catch (error) {
      logger.error('Error creating communication', {
        error: error.message,
        patientId: data.patient
      });
      throw error;
    }
  },
  
  /**
   * Send a communication through all specified channels
   * @param {string} communicationId - Communication ID
   * @returns {Promise<Object>} Updated communication with delivery status
   */
  sendCommunication: async (communicationId) => {
    try {
      const communication = await Communication.findById(communicationId)
        .populate('patient', 'firstName lastName');
      
      if (!communication) {
        throw new NotFoundError('Communication not found');
      }
      
      // Get patient preferences
      const preferences = await CommunicationPreference.findOne({ patient: communication.patient._id });
      
      if (!preferences) {
        logger.warn(`No communication preferences found for patient ${communication.patient._id}`, {
          patientId: communication.patient._id,
          communicationId
        });
      }
      
      // Check if patient has opted out of all communications
      if (preferences?.optOut?.allCommunications) {
        logger.info(`Patient ${communication.patient._id} has opted out of all communications`, {
          patientId: communication.patient._id,
          communicationId
        });
        
        // Update delivery status for all channels
        communication.deliveryTracking.forEach(track => {
          track.status = DELIVERY_STATUS.CANCELLED;
        });
        
        await communication.save();
        return communication;
      }
      
      // Check specific notification type opt-out
      if (preferences && !preferences.canReceiveNotification(communication.type)) {
        logger.info(`Patient ${communication.patient._id} has opted out of ${communication.type} communications`, {
          patientId: communication.patient._id,
          communicationId,
          type: communication.type
        });
        
        // Update delivery status for all channels
        communication.deliveryTracking.forEach(track => {
          track.status = DELIVERY_STATUS.CANCELLED;
        });
        
        await communication.save();
        return communication;
      }
      
      // Check if in do-not-disturb period
      const isEmergency = communication.type === COMMUNICATION_TYPES.EMERGENCY;
      if (preferences && 
          preferences.isInDoNotDisturbPeriod(communication.type) && 
          !(isEmergency && preferences.doNotDisturb.overrideForEmergencies)) {
        
        logger.info(`Communication delayed due to do-not-disturb period`, {
          patientId: communication.patient._id,
          communicationId
        });
        
        // Reschedule outside DND period
        communication.scheduledFor = communicationService.getTimeAfterDND(preferences);
        communication.deliveryTracking.forEach(track => {
          track.status = DELIVERY_STATUS.SCHEDULED;
        });
        
        await communication.save();
        return communication;
      }
      
      // Send through each channel
      for (const track of communication.deliveryTracking) {
        if (track.status === DELIVERY_STATUS.SENT || 
            track.status === DELIVERY_STATUS.DELIVERED) {
          continue; // Skip already sent notifications
        }
        
        // Check if patient has channel-specific opt-out
        if (preferences && !preferences.canReceiveNotification(communication.type, track.channel)) {
          track.status = DELIVERY_STATUS.CANCELLED;
          track.failureReason = 'Patient has opted out of this channel';
          continue;
        }
        
        try {
          switch (track.channel) {
            case COMMUNICATION_CHANNELS.EMAIL:
              const emailResult = await communicationService.sendViaEmail(communication, preferences);
              track.status = DELIVERY_STATUS.SENT;
              track.sentAt = new Date();
              track.externalId = emailResult.messageId;
              break;
              
            case COMMUNICATION_CHANNELS.SMS:
              const smsResult = await communicationService.sendViaSMS(communication, preferences);
              track.status = DELIVERY_STATUS.SENT;
              track.sentAt = new Date();
              track.externalId = smsResult.messageId;
              break;
              
            case COMMUNICATION_CHANNELS.IN_APP:
              const notificationResult = await communicationService.sendViaInApp(communication);
              track.status = DELIVERY_STATUS.SENT;
              track.sentAt = new Date();
              track.externalId = notificationResult.notificationId;
              break;
              
            case COMMUNICATION_CHANNELS.PUSH:
              // Push notification implementation would go here
              track.status = DELIVERY_STATUS.FAILED;
              track.failureReason = 'Push notifications not implemented yet';
              break;
              
            default:
              track.status = DELIVERY_STATUS.FAILED;
              track.failureReason = `Unknown channel: ${track.channel}`;
          }
        } catch (error) {
          logger.error(`Failed to send communication via ${track.channel}`, {
            error: error.message,
            communicationId,
            channel: track.channel
          });
          
          track.status = DELIVERY_STATUS.FAILED;
          track.failureReason = error.message;
          track.retryCount += 1;
        }
      }
      
      await communication.save();
      
      logger.info(`Communication processed for patient ${communication.patient._id}`, {
        communicationId,
        channels: communication.channels,
        successful: communication.deliveryTracking.filter(t => 
          t.status === DELIVERY_STATUS.SENT || t.status === DELIVERY_STATUS.DELIVERED
        ).length
      });
      
      return communication;
    } catch (error) {
      logger.error('Error sending communication', {
        error: error.message,
        communicationId
      });
      throw error;
    }
  },
  
  /**
   * Send communication via email
   * @param {Object} communication - Communication object
   * @param {Object} preferences - Patient communication preferences
   * @returns {Promise<Object>} Email send result
   */
  sendViaEmail: async (communication, preferences) => {
    try {
      // Check if we have an email address
      const emailAddress = preferences?.contactInfo?.email?.address || 
                          communication.patient.email;
      
      if (!emailAddress) {
        throw new ValidationError('No email address available for patient');
      }
      
      // Prepare email content based on communication type
      const emailContent = communicationService.prepareEmailContent(communication);
      
      // Send the email
      const result = await emailService.sendEmail({
        to: emailAddress,
        subject: emailContent.subject || communication.subject,
        text: emailContent.text,
        html: emailContent.html,
        priority: communication.priority === 'urgent' ? 'high' : communication.priority
      });
      
      logger.info(`Email sent to patient ${communication.patient._id}`, {
        communicationId: communication._id,
        emailId: result.messageId
      });
      
      return result;
    } catch (error) {
      logger.error('Error sending email', {
        error: error.message,
        communicationId: communication._id
      });
      throw error;
    }
  },
  
  /**
   * Send communication via SMS (mock implementation)
   * @param {Object} communication - Communication object
   * @param {Object} preferences - Patient communication preferences
   * @returns {Promise<Object>} SMS send result
   */
  sendViaSMS: async (communication, preferences) => {
    try {
      // Check if we have a phone number
      const phoneNumber = preferences?.contactInfo?.phone?.number || 
                         communication.patient.phoneNumber;
      
      if (!phoneNumber) {
        throw new ValidationError('No phone number available for patient');
      }
      
      // In a real implementation, this would integrate with an SMS provider like Twilio
      // This is a mock implementation for development
      
      // Prepare SMS content (shorter than email)
      const smsContent = communicationService.prepareSMSContent(communication);
      
      // Log the mock SMS
      logger.info(`MOCK SMS to ${phoneNumber}: ${smsContent}`);
      
      // Simulate SMS delivery
      const mockResult = {
        success: true,
        messageId: `mock-sms-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        to: phoneNumber,
        status: 'sent'
      };
      
      return mockResult;
    } catch (error) {
      logger.error('Error sending SMS', {
        error: error.message,
        communicationId: communication._id
      });
      throw error;
    }
  },
  
  /**
   * Send communication via in-app notification
   * @param {Object} communication - Communication object
   * @returns {Promise<Object>} In-app notification result
   */
  sendViaInApp: async (communication) => {
    try {
      // Find the user associated with this patient
      const Patient = mongoose.model('Patient');
      const patient = await Patient.findById(communication.patient._id)
        .populate('user', '_id');
      
      if (!patient || !patient.user) {
        throw new ValidationError('No user account associated with this patient');
      }
      
      // Convert communication to notification
      let actionLink;
      
      // Set appropriate action link based on communication type
      if (communication.relatedTo) {
        switch (communication.relatedTo.model) {
          case 'Appointment':
            actionLink = `/appointments/${communication.relatedTo.id}`;
            break;
          case 'MedicalRecord':
            actionLink = `/medical-records/${communication.relatedTo.id}`;
            break;
          case 'Prescription':
            actionLink = `/prescriptions/${communication.relatedTo.id}`;
            break;
        }
      }
      
      // Create notification
      const notification = new Notification({
        recipient: patient.user._id,
        title: communication.subject,
        message: communication.body,
        type: communication.type,
        priority: communication.priority,
        actionLink,
        relatedTo: communication.relatedTo ? {
          model: communication.relatedTo.model,
          id: communication.relatedTo.id
        } : undefined,
        icon: communicationService.getIconForType(communication.type),
        expiresAt: communication.expiresAt
      });
      
      await notification.save();
      
      logger.info(`In-app notification created for user ${patient.user._id}`, {
        communicationId: communication._id,
        notificationId: notification._id
      });
      
      return { 
        success: true, 
        notificationId: notification._id 
      };
    } catch (error) {
      logger.error('Error creating in-app notification', {
        error: error.message,
        communicationId: communication._id
      });
      throw error;
    }
  },
  
  /**
   * Create appointment reminder
   * @param {Object} appointment - Appointment object
   * @param {number} hoursInAdvance - Hours in advance to send (optional)
   * @returns {Promise<Object>} Created communication
   */
  createAppointmentReminder: async (appointment, hoursInAdvance) => {
    try {
      // Get patient preferences for notification timing
      const preferences = await CommunicationPreference.findOne({ 
        patient: appointment.patient 
      });
      
      // Use patient preference or default if not found
      const advanceHours = hoursInAdvance || 
        (preferences?.channelPreferences?.appointment_reminder?.advanceNotice || 24);
      
      // Calculate scheduled time
      const scheduledFor = new Date(appointment.startTime);
      scheduledFor.setHours(scheduledFor.getHours() - advanceHours);
      
      // Don't schedule if appointment is already in the past or reminder time is in the past
      const now = new Date();
      if (new Date(appointment.startTime) < now || scheduledFor < now) {
        logger.info('Appointment reminder not created because appointment or reminder time is in the past', {
          appointmentId: appointment._id,
          appointmentTime: appointment.startTime
        });
        return null;
      }
      
      // Format the date and time for display
      const apptDate = new Date(appointment.startTime).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      const apptTime = new Date(appointment.startTime).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      // Create communication object
      const communicationData = {
        patient: appointment.patient,
        type: COMMUNICATION_TYPES.APPOINTMENT_REMINDER,
        subject: `Appointment Reminder: ${apptDate} at ${apptTime}`,
        body: `This is a reminder that you have an appointment on ${apptDate} at ${apptTime} with Dr. ${appointment.doctor?.lastName || 'your healthcare provider'}.`,
        // Set priority based on how close to appointment
        priority: advanceHours <= 2 ? 'high' : 'medium',
        scheduledFor,
        relatedTo: {
          model: 'Appointment',
          id: appointment._id
        },
        metadata: {
          appointmentTime: appointment.startTime,
          appointmentType: appointment.appointmentType,
          doctorName: `${appointment.doctor?.firstName || ''} ${appointment.doctor?.lastName || ''}`.trim() || 'your healthcare provider',
          location: appointment.location || 'our facility' 
        }
      };
      
      // Create the communication
      const communication = await communicationService.createCommunication(communicationData);
      
      logger.info(`Appointment reminder scheduled for patient ${appointment.patient}`, {
        appointmentId: appointment._id,
        communicationId: communication._id,
        scheduledFor
      });
      
      return communication;
    } catch (error) {
      logger.error('Error creating appointment reminder', {
        error: error.message,
        appointmentId: appointment?._id,
        patientId: appointment?.patient
      });
      throw error;
    }
  },
  
  /**
   * Create test result notification
   * @param {Object} testResult - Test result object with patient, test details
   * @param {boolean} urgent - Whether this is an urgent notification
   * @returns {Promise<Object>} Created communication
   */
  createTestResultNotification: async (testResult, urgent = false) => {
    try {
      const testName = testResult.name || 'medical test';
      const testDate = new Date(testResult.date || Date.now()).toLocaleDateString('en-US');
      
      // Determine appropriate message based on urgency
      let subject, body, priority;
      
      if (urgent) {
        subject = `URGENT: New Test Results Available for ${testName}`;
        body = `Your recent test results for ${testName} from ${testDate} require immediate attention. Please contact your healthcare provider as soon as possible to discuss these results.`;
        priority = 'urgent';
      } else {
        subject = `New Test Results Available for ${testName}`;
        body = `Your test results for ${testName} from ${testDate} are now available. Please log in to your patient portal to view them or discuss them with your healthcare provider at your next appointment.`;
        priority = 'medium';
      }
      
      // Create communication object
      const communicationData = {
        patient: testResult.patient,
        type: COMMUNICATION_TYPES.TEST_RESULT,
        subject,
        body,
        priority,
        relatedTo: testResult.medicalRecord ? {
          model: 'MedicalRecord',
          id: testResult.medicalRecord
        } : undefined,
        metadata: {
          testName: testResult.name,
          testDate: testResult.date,
          urgent
        }
      };
      
      // Create the communication
      const communication = await communicationService.createCommunication(communicationData);
      
      logger.info(`Test result notification created for patient ${testResult.patient}`, {
        testId: testResult._id,
        communicationId: communication._id,
        urgent
      });
      
      return communication;
    } catch (error) {
      logger.error('Error creating test result notification', {
        error: error.message,
        testId: testResult?._id,
        patientId: testResult?.patient
      });
      throw error;
    }
  },
  
  /**
   * Create prescription refill alert
   * @param {Object} prescription - Prescription object
   * @param {number} daysBeforeEmpty - Days before prescription runs out
   * @returns {Promise<Object>} Created communication
   */
  createPrescriptionRefillAlert: async (prescription, daysBeforeEmpty) => {
    try {
      // Get patient preferences for notification timing
      const preferences = await CommunicationPreference.findOne({ 
        patient: prescription.patient 
      });
      
      // Use patient preference or default if not found
      const daysBefore = daysBeforeEmpty || 
        (preferences?.channelPreferences?.prescription_refill?.refillReminder || 5);
      
      // Calculate when prescription will run out
      let runOutDate;
      
      if (prescription.endDate) {
        runOutDate = new Date(prescription.endDate);
      } else if (prescription.startDate && prescription.daysSupply) {
        runOutDate = new Date(prescription.startDate);
        runOutDate.setDate(runOutDate.getDate() + prescription.daysSupply);
      } else {
        throw new ValidationError('Cannot determine when prescription will run out');
      }
      
      // Calculate when to send the reminder
      const reminderDate = new Date(runOutDate);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);
      
      // Don't schedule if reminder date is in the past
      if (reminderDate < new Date()) {
        logger.info('Prescription refill reminder not created because reminder date is in the past', {
          prescriptionId: prescription._id,
          runOutDate
        });
        return null;
      }
      
      // Format the date for display
      const formattedDate = runOutDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Create communication object
      const communicationData = {
        patient: prescription.patient,
        type: COMMUNICATION_TYPES.PRESCRIPTION_REFILL,
        subject: `Prescription Refill Reminder: ${prescription.medication}`,
        body: `Your prescription for ${prescription.medication} (${prescription.dosage}) will run out on ${formattedDate}. Please contact your pharmacy to arrange a refill.`,
        priority: 'medium',
        scheduledFor: reminderDate,
        relatedTo: {
          model: 'Prescription',
          id: prescription._id
        },
        metadata: {
          medicationName: prescription.medication,
          dosage: prescription.dosage,
          runOutDate: runOutDate,
          pharmacy: prescription.pharmacy
        }
      };
      
      // Create the communication
      const communication = await communicationService.createCommunication(communicationData);
      
      logger.info(`Prescription refill reminder scheduled for patient ${prescription.patient}`, {
        prescriptionId: prescription._id,
        communicationId: communication._id,
        scheduledFor: reminderDate
      });
      
      return communication;
    } catch (error) {
      logger.error('Error creating prescription refill alert', {
        error: error.message,
        prescriptionId: prescription?._id,
        patientId: prescription?.patient
      });
      throw error;
    }
  },
  
  /**
   * Create health tip notification
   * @param {string} patientId - Patient ID
   * @param {Object} tipData - Health tip data
   * @returns {Promise<Object>} Created communication
   */
  createHealthTip: async (patientId, tipData) => {
    try {
      // Create communication object
      const communicationData = {
        patient: patientId,
        type: COMMUNICATION_TYPES.HEALTH_TIP,
        subject: tipData.title || 'Health Tip',
        body: tipData.content,
        priority: 'low',
        metadata: {
          category: tipData.category,
          source: tipData.source
        }
      };
      
      // Create the communication
      const communication = await communicationService.createCommunication(communicationData);
      
      logger.info(`Health tip created for patient ${patientId}`, {
        communicationId: communication._id,
        tipTitle: tipData.title
      });
      
      return communication;
    } catch (error) {
      logger.error('Error creating health tip', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Create emergency notification
   * @param {string} patientId - Patient ID
   * @param {Object} emergencyData - Emergency notification data
   * @returns {Promise<Object>} Created communication
   */
  createEmergencyNotification: async (patientId, emergencyData) => {
    try {
      // Create communication object
      const communicationData = {
        patient: patientId,
        type: COMMUNICATION_TYPES.EMERGENCY,
        subject: `EMERGENCY: ${emergencyData.title}`,
        body: emergencyData.message,
        priority: 'urgent',
        metadata: {
          emergencyType: emergencyData.type,
          actionRequired: emergencyData.actionRequired,
          contactNumber: emergencyData.contactNumber
        }
      };
      
      // Create the communication
      const communication = await communicationService.createCommunication(communicationData);
      
      logger.info(`Emergency notification created for patient ${patientId}`, {
        communicationId: communication._id,
        emergencyType: emergencyData.type
      });
      
      return communication;
    } catch (error) {
      logger.error('Error creating emergency notification', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Create or update patient communication preferences
   * @param {string} patientId - Patient ID
   * @param {Object} preferencesData - Communication preferences data
   * @returns {Promise<Object>} Updated preferences
   */
  updateCommunicationPreferences: async (patientId, preferencesData) => {
    try {
      // Find existing preferences
      let preferences = await CommunicationPreference.findOne({ patient: patientId });
      
      if (!preferences) {
        // Create new preferences if not found
        preferences = new CommunicationPreference({ 
          patient: patientId,
          ...preferencesData
        });
      } else {
        // Update existing preferences
        if (preferencesData.channelPreferences) {
          for (const [type, settings] of Object.entries(preferencesData.channelPreferences)) {
            if (preferences.channelPreferences[type]) {
              // Update existing type preferences
              Object.assign(preferences.channelPreferences[type], settings);
            } else {
              // Add new type preferences
              preferences.channelPreferences[type] = settings;
            }
          }
        }
        
        // Update do-not-disturb settings if provided
        if (preferencesData.doNotDisturb) {
          Object.assign(preferences.doNotDisturb, preferencesData.doNotDisturb);
        }
        
        // Update contact info if provided
        if (preferencesData.contactInfo) {
          if (preferencesData.contactInfo.email) {
            Object.assign(
              preferences.contactInfo.email, 
              preferencesData.contactInfo.email
            );
          }
          if (preferencesData.contactInfo.phone) {
            Object.assign(
              preferences.contactInfo.phone, 
              preferencesData.contactInfo.phone
            );
          }
        }
        
        // Update opt-out settings if provided
        if (preferencesData.optOut) {
          Object.assign(preferences.optOut, preferencesData.optOut);
        }
      }
      
      await preferences.save();
      
      logger.info(`Communication preferences updated for patient ${patientId}`, {
        preferenceId: preferences._id
      });
      
      return preferences;
    } catch (error) {
      logger.error('Error updating communication preferences', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Create default communication preferences for a patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Created preferences
   */
  createDefaultPreferences: async (patientId) => {
    try {
      // Get patient info to set up preferences
      const Patient = mongoose.model('Patient');
      const patient = await Patient.findById(patientId);
      
      if (!patient) {
        throw new NotFoundError('Patient not found');
      }
      
      // Create default preferences
      const preferences = new CommunicationPreference({
        patient: patientId,
        channelPreferences: {
          appointment_reminder: {
            channels: [COMMUNICATION_CHANNELS.EMAIL, COMMUNICATION_CHANNELS.IN_APP],
            enabled: true,
            advanceNotice: 24
          },
          test_result: {
            channels: [COMMUNICATION_CHANNELS.EMAIL, COMMUNICATION_CHANNELS.IN_APP],
            enabled: true
          },
          prescription_refill: {
            channels: [COMMUNICATION_CHANNELS.EMAIL, COMMUNICATION_CHANNELS.IN_APP],
            enabled: true,
            refillReminder: 5
          },
          health_tip: {
            channels: [COMMUNICATION_CHANNELS.EMAIL, COMMUNICATION_CHANNELS.IN_APP],
            enabled: true,
            frequency: 'weekly'
          },
          emergency: {
            channels: [COMMUNICATION_CHANNELS.EMAIL, COMMUNICATION_CHANNELS.SMS, COMMUNICATION_CHANNELS.IN_APP],
            enabled: true
          },
          general: {
            channels: [COMMUNICATION_CHANNELS.EMAIL, COMMUNICATION_CHANNELS.IN_APP],
            enabled: true
          }
        },
        contactInfo: {
          email: {
            address: patient.email || null,
            verified: false
          },
          phone: {
            number: patient.phoneNumber || null,
            verified: false
          }
        }
      });
      
      await preferences.save();
      
      logger.info(`Default communication preferences created for patient ${patientId}`, {
        preferenceId: preferences._id
      });
      
      return preferences;
    } catch (error) {
      logger.error('Error creating default communication preferences', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Get all communications for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Communications list
   */
  getPatientCommunications: async (patientId, filters = {}) => {
    try {
      const {
        type,
        startDate,
        endDate,
        status,
        page = 1,
        limit = 20,
        sort = '-createdAt'
      } = filters;
      
      // Build query
      const query = { patient: patientId };
      
      // Add type filter
      if (type) {
        query.type = type;
      }
      
      // Add date range filter
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }
      
      // Add status filter
      if (status) {
        query['deliveryTracking.status'] = status;
      }
      
      // Execute query with pagination
      const totalCount = await Communication.countDocuments(query);
      
      const communications = await Communication.find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit);
      
      return {
        total: totalCount,
        page,
        pages: Math.ceil(totalCount / limit),
        limit,
        communications
      };
    } catch (error) {
      logger.error('Error retrieving patient communications', {
        error: error.message,
        patientId
      });
      throw error;
    }
  },
  
  /**
   * Mark communication as delivered
   * @param {string} communicationId - Communication ID
   * @param {string} channel - Communication channel
   * @returns {Promise<Object>} Updated communication
   */
  markAsDelivered: async (communicationId, channel) => {
    try {
      const communication = await Communication.findById(communicationId);
      
      if (!communication) {
        throw new NotFoundError('Communication not found');
      }
      
      // Find the channel in delivery tracking
      const trackingEntry = communication.deliveryTracking.find(
        track => track.channel === channel && track.status === DELIVERY_STATUS.SENT
      );
      
      if (!trackingEntry) {
        throw new ValidationError('No matching channel found with "sent" status');
      }
      
      // Update status
      trackingEntry.status = DELIVERY_STATUS.DELIVERED;
      trackingEntry.deliveredAt = new Date();
      
      await communication.save();
      
      logger.info(`Communication marked as delivered`, {
        communicationId,
        channel
      });
      
      return communication;
    } catch (error) {
      logger.error('Error marking communication as delivered', {
        error: error.message,
        communicationId,
        channel
      });
      throw error;
    }
  },
  
  /**
   * Mark communication as read
   * @param {string} communicationId - Communication ID
   * @param {string} channel - Communication channel
   * @returns {Promise<Object>} Updated communication
   */
  markAsRead: async (communicationId, channel) => {
    try {
      const communication = await Communication.findById(communicationId);
      
      if (!communication) {
        throw new NotFoundError('Communication not found');
      }
      
      // Find the channel in delivery tracking
      const trackingEntry = communication.deliveryTracking.find(
        track => track.channel === channel && 
        (track.status === DELIVERY_STATUS.SENT || track.status === DELIVERY_STATUS.DELIVERED)
      );
      
      if (!trackingEntry) {
        throw new ValidationError('No matching channel found with appropriate status');
      }
      
      // Update status
      trackingEntry.status = DELIVERY_STATUS.READ;
      trackingEntry.readAt = new Date();
      
      await communication.save();
      
      logger.info(`Communication marked as read`, {
        communicationId,
        channel
      });
      
      return communication;
    } catch (error) {
      logger.error('Error marking communication as read', {
        error: error.message,
        communicationId,
        channel
      });
      throw error;
    }
  },
  
  /**
   * Get icon for notification type
   * @param {string} type - Communication type
   * @returns {string} Icon name
   */
  getIconForType: (type) => {
    switch (type) {
      case COMMUNICATION_TYPES.APPOINTMENT_REMINDER:
        return 'calendar';
      case COMMUNICATION_TYPES.TEST_RESULT:
        return 'lab';
      case COMMUNICATION_TYPES.PRESCRIPTION_REFILL:
        return 'prescription';
      case COMMUNICATION_TYPES.HEALTH_TIP:
        return 'heart';
      case COMMUNICATION_TYPES.EMERGENCY:
        return 'alert';
      default:
        return 'notification';
    }
  },
  
  /**
   * Prepare email content based on communication type
   * @param {Object} communication - Communication object
   * @returns {Object} Email content object
   */
  prepareEmailContent: (communication) => {
    // Base content from communication
    const content = {
      subject: communication.subject,
      text: communication.body,
      html: `
<p>
${communication.body}
</p>
      `
    };

    // Add custom HTML based on communication type and metadata
    if (communication.type === COMMUNICATION_TYPES.APPOINTMENT_REMINDER) {
      const metadata = communication.metadata || {};
      const doctorName = metadata.doctorName || 'your healthcare provider';
      const location = metadata.location || 'our facility';
      const appointmentTime = metadata.appointmentTime
        ? new Date(metadata.appointmentTime).toLocaleString('en-US')
        : 'your scheduled time';

      content.html = `
<h2>Appointment Reminder</h2>
<p>Dear ${communication.patient.firstName},</p>
<p>This is a reminder that you have an appointment on 
<strong>${appointmentTime}</strong> with 
<strong>${doctorName}</strong> at ${location}.</p>
<p>If you need to reschedule, please contact us as soon as possible.</p>
<p>Thank you,<br>Healthcare Management Team</p>
      `;
    } else if (communication.type === COMMUNICATION_TYPES.TEST_RESULT) {
      const metadata = communication.metadata || {};
      const urgent = metadata.urgent;

      content.html = `
<h2>${urgent ? 'URGENT: ' : ''}Test Results Available</h2>
<p>Dear ${communication.patient.firstName},</p>
<p>${communication.body}</p>
${urgent ? `
<p><strong>This requires your immediate attention.</strong></p>
` : ''}
<p>Please log in to your patient portal to view your results.</p>
<p>Thank you,<br>Healthcare Management Team</p>
      `;
    }

    // Similar customizations for other communication types

    return content;
  },

  /**
   * Prepare SMS content (shorter version of email)
   * @param {Object} communication - Communication object
   * @returns {string} SMS content
   */
  prepareSMSContent: (communication) => {
    // For SMS, we need a shorter message
    let content = communication.body;

    // If longer than 160 chars, truncate and add link
    if (content.length > 140) {
      content = content.substring(0, 137) + '...';
    }

    // Add prefix based on priority
    if (communication.priority === 'urgent') {
      content = 'URGENT: ' + content;
    }

    return content;
  },

  /**
   * Get time after do-not-disturb period
   * @param {Object} preferences - Communication preferences
   * @returns {Date} Time after DND period
   */
  getTimeAfterDND: (preferences) => {
    const now = new Date();
    const [endHour, endMinute] = preferences.doNotDisturb.endTime.split(':').map(Number);

    // Set to same day, after DND period
    const afterDND = new Date(now);
    afterDND.setHours(endHour, endMinute + 1, 0, 0);

    // If after DND time has already passed today, schedule for tomorrow
    if (afterDND <= now) {
      afterDND.setDate(afterDND.getDate() + 1);
    }

    return afterDND;
  },

  /**
   * Process scheduled communications that are due
   * @returns {Promise<number>} Number of communications processed
   */
  processScheduledCommunications: async () => {
    try {
      const now = new Date();

      // Find scheduled communications that are due
      const scheduledCommunications = await Communication.find({
        'deliveryTracking.status': DELIVERY_STATUS.SCHEDULED,
        scheduledFor: { $lte: now }
      });

      logger.info(`Processing ${scheduledCommunications.length} scheduled communications`);

      // Process each communication
      for (const communication of scheduledCommunications) {
        try {
          await communicationService.sendCommunication(communication._id);
        } catch (error) {
          logger.error(`Error processing scheduled communication ${communication._id}`, {
            error: error.message
          });
        }
      }

      return scheduledCommunications.length;
    } catch (error) {
      logger.error('Error processing scheduled communications', {
        error: error.message
      });
      throw error;
    }
  }
};

module.exports = communicationService;
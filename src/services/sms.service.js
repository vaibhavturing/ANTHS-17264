const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * SMS service for sending text messages
 * This is a new service file added for handling SMS notifications
 */
const smsService = {
  /**
   * Send an SMS message
   * @param {string} to - Recipient phone number
   * @param {string} message - SMS content
   * @returns {Promise<Object>} Result of the SMS operation
   */
  sendSMS: async (to, message) => {
    try {
      // In a real implementation, this would use an SMS service like Twilio, Nexmo, etc.
      // For development, we'll log the SMS content
      
      logger.info(`MOCK SMS: To ${to}`);
      logger.info(`MOCK SMS: Message: ${message}`);

      if (config.NODE_ENV === 'production') {
        // Example integration with an SMS provider (pseudocode)
        // const smsProvider = require('../config/smsProvider');
        // return await smsProvider.send({
        //   to,
        //   from: config.SMS_FROM_NUMBER,
        //   body: message
        // });
      }

      // Return success for development/testing
      return {
        success: true,
        message: `SMS sent successfully to ${to}`
      };
    } catch (error) {
      logger.error('Failed to send SMS', {
        error: error.message,
        phone: to
      });
      throw new Error('Failed to send SMS');
    }
  },
  
  /**
   * Send emergency notification SMS
   * @param {string} to - Recipient phone number
   * @param {string} type - Notification type
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Result of the SMS operation
   */
  sendEmergencySMS: async (to, type, data) => {
    try {
      let message = '';
      
      switch(type) {
        case 'appointment_cancelled':
          message = `URGENT: Your appointment on ${new Date(data.appointment.startTime).toLocaleDateString()} has been cancelled due to an emergency. Please call us to reschedule.`;
          break;
          
        case 'appointment_rescheduled':
          message = `Your appointment has been rescheduled to ${new Date(data.newAppointment.startTime).toLocaleDateString()} at ${new Date(data.newAppointment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} with Dr. ${data.newDoctor.lastName}. Reply Y to confirm or call us to change.`;
          break;
          
        default:
          message = `Important message from your healthcare provider. Please check your email or call us for more information.`;
      }
      
      return await smsService.sendSMS(to, message);
    } catch (error) {
      logger.error('Failed to send emergency SMS', {
        error: error.message,
        phone: to,
        type
      });
      throw new Error('Failed to send emergency SMS');
    }
  }
};

module.exports = smsService;
const config = require('../config/config');
const logger = require('../utils/logger');
const { ValidationError } = require('../utils/errors');

/**
 * Email service for sending transactional emails 
 * in the Healthcare Management Application
 */
const emailService = {
  /**
   * Send a generic email
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text email content
   * @param {string} options.html - HTML email content
   * @param {string} [options.cc] - CC recipients (optional)
   * @param {string} [options.bcc] - BCC recipients (optional)
   * @param {string} [options.from] - Sender email (optional, uses default from config)
   * @param {string} [options.priority] - Email priority (high, normal, low)
   * @returns {Promise<Object>} Result of the email operation
   */

  
  sendEmail: async (options) => {
    try {
      const { to, subject, text, html, cc, bcc, from, priority = 'normal' } = options;

      // Validate required fields
      if (!to || !subject || (!text && !html)) {
        throw new ValidationError('Missing required email fields');
      }

      // Mock email implementation for development
      logger.info(`MOCK EMAIL: Sending email to ${to}`, {
        subject,
        priority,
        cc: cc || 'none',
        bcc: bcc || 'none'
      });

      if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') {
        logger.info('MOCK EMAIL CONTENT:');
        logger.info(`Subject: ${subject}`);
        logger.info(`Text: ${text || 'No plain text provided'}`);
        logger.info(`HTML: ${html ? '[HTML Content Available]' : 'No HTML provided'}`);
      }

      if (config.NODE_ENV === 'production') {
        // TODO: Replace with actual email provider integration
        // const emailProvider = require('../config/emailProvider');
        // return await emailProvider.send({
        //   to,
        //   from: from || config.EMAIL_FROM,
        //   subject,
        //   text,
        //   html,
        //   cc,
        //   bcc,
        //   priority
        // });
      }

      // Return success for development/testing
      return {
        success: true,
        messageId: `mock-email-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        message: `Email sent successfully to ${to}`,
      };
    } catch (error) {
      logger.error('Failed to send email', {
        error: error.message,
        email: options.to
      });
      throw error;
    }
  },

  /**
   * Send a password reset email
   * @param {string} to - Recipient email address
   * @param {string} resetLink - Password reset link
   * @returns {Promise<Object>} Result of the email operation
   */
  sendPasswordResetEmail: async (to, resetLink) => {
    try {
      return await emailService.sendEmail({
        to,
        subject: 'Password Reset Request - Healthcare App',
        text: `You requested a password reset. Click this link to reset your password: ${resetLink}. This link expires in 60 minutes.`,
        html: `
          <p>You requested a password reset.</p>
          <p>Click <a href="${resetLink}">this link</a> to reset your password.</p>
          <p>This link expires in 60 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
        priority: 'high'
      });
    } catch (error) {
      logger.error('Failed to send password reset email', {
        error: error.message,
        email: to
      });
      throw new Error('Failed to send password reset email');
    }
  },

  /**
   * Send an appointment confirmation email
   * @param {string} to - Recipient email address
   * @param {Object} appointmentDetails - Appointment details
   * @returns {Promise<Object>} Result of the email operation
   */
  sendAppointmentConfirmationEmail: async (to, appointmentDetails) => {
    try {
      const {
        appointmentDate,
        appointmentTime,
        doctorName,
        patientName,
        location,
        appointmentType
      } = appointmentDetails;

      return await emailService.sendEmail({
        to,
        subject: `Appointment Confirmation: ${appointmentDate} at ${appointmentTime}`,
        text: `Your appointment with Dr. ${doctorName} has been confirmed for ${appointmentDate} at ${appointmentTime}. Location: ${location}. Type: ${appointmentType}.`,
        html: `
          <h2>Appointment Confirmation</h2>
          <p>Dear ${patientName},</p>
          <p>Your appointment has been confirmed with the following details:</p>
          <ul>
            <li><strong>Date:</strong> ${appointmentDate}</li>
            <li><strong>Time:</strong> ${appointmentTime}</li>
            <li><strong>Doctor:</strong> Dr. ${doctorName}</li>
            <li><strong>Location:</strong> ${location}</li>
            <li><strong>Type:</strong> ${appointmentType}</li>
          </ul>
          <p>Please arrive 15 minutes before your appointment time.</p>
          <p>If you need to reschedule, please contact us at least 24 hours in advance.</p>
        `
      });
    } catch (error) {
      logger.error('Failed to send appointment confirmation email', {
        error: error.message,
        email: to
      });
      throw new Error('Failed to send appointment confirmation email');
    }
  },

  /**
   * Send a test results notification email
   * @param {string} to - Recipient email address
   * @param {Object} resultDetails - Test result details
   * @returns {Promise<Object>} Result of the email operation
   */
  sendTestResultsEmail: async (to, resultDetails) => {
    try {
      const {
        patientName,
        testName,
        testDate,
        isUrgent,
        portalLink
      } = resultDetails;

      const subject = isUrgent
        ? `URGENT: Your ${testName} Results are Available`
        : `Your ${testName} Results are Available`;

      const text = `Dear ${patientName}, your test results for ${testName} performed on ${testDate} are now available. ${
        isUrgent
          ? 'These results require immediate attention. Please contact your healthcare provider as soon as possible.'
          : 'You can view them by logging into your patient portal.'
      }`;

      const html = `
        <h2>${isUrgent ? 'URGENT: ' : ''}Test Results Available</h2>
        <p>Dear ${patientName},</p>
        <p>Your results for the following test are now available:</p>
        <ul>
          <li><strong>Test:</strong> ${testName}</li>
          <li><strong>Date:</strong> ${testDate}</li>
        </ul>
        ${
          isUrgent
            ? `
              <p>These results require immediate attention.</p>
              <p>Please contact your healthcare provider as soon as possible to discuss these results.</p>
            `
            : `
              <p>You can view your results by logging in to your <a href="${portalLink}">patient portal</a>.</p>
            `
        }
      `;

      return await emailService.sendEmail({
        to,
        subject,
        priority: isUrgent ? 'high' : 'normal',
        text,
        html
      });
    } catch (error) {
      logger.error('Failed to send test results email', {
        error: error.message,
        email: to
      });
      throw new Error('Failed to send test results email');
    }
  },

   /**
   * Send a staff notification email
   * @param {string} type - Notification type
   * @param {string} subject - Email subject
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Result of the email operation
   */
  sendStaffNotificationEmail: async (type, subject, data) => {
    try {
      logger.info(`MOCK EMAIL: Staff Notification - ${subject}`);
      logger.info(`MOCK EMAIL: Type: ${type}`);
      logger.info(`MOCK EMAIL: Data: ${JSON.stringify(data)}`);

      // NEW: Handle emergency notification emails to staff
      let mockEmailContent = '';

      if (type === 'doctor_emergency_unavailable') {
        const doctorName = data.data.doctorName;
        const startDate = new Date(data.data.startDate).toLocaleDateString();
        const endDate = new Date(data.data.endDate).toLocaleDateString();
        const count = data.data.affectedAppointmentsCount;
        const reason = data.data.reason;

        mockEmailContent = `
EMERGENCY ALERT: Doctor Unavailable

Doctor ${doctorName} is unavailable from ${startDate} to ${endDate} due to ${reason}.
There are ${count} appointment(s) affected that need immediate attention.

Affected appointments:
${data.data.affectedAppointments.map(apt =>
  `- ${apt.patientName} (${apt.appointmentType}) on ${new Date(apt.startTime).toLocaleString()}`
).join('\n')}

URGENT: Please log in to the admin portal immediately to manage these appointments.
`;
        logger.info(`MOCK EMAIL CONTENT:\n${mockEmailContent}`);
      }

      if (config.NODE_ENV === 'production') {
        // const emailProvider = require('../config/emailProvider');
        // const emailTemplate = getEmailTemplateForType(type, data);
        // return await emailProvider.send({
        //   to: getStaffEmailsForType(type),
        //   from: config.EMAIL_FROM,
        //   subject,
        //   text: emailTemplate.text,
        //   html: emailTemplate.html
        // });
      }

      return {
        success: true,
        message: `Staff notification email sent successfully`,
      };
    } catch (error) {
      logger.error('Failed to send staff notification email', {
        error: error.message,
        type,
        subject,
      });
      throw new Error('Failed to send staff notification email');
    }
  },

  /**
   * Send a patient notification email
   * @param {string} to - Patient email address
   * @param {string} type - Notification type
   * @param {string} subject - Email subject
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} Result of the email operation
   */
  sendPatientNotificationEmail: async (to, type, subject, data) => {
    try {
      logger.info(`MOCK EMAIL: Patient Notification to ${to} - ${subject}`);
      logger.info(`MOCK EMAIL: Type: ${type}`);
      logger.info(`MOCK EMAIL: Data: ${JSON.stringify(data)}`);

      let mockEmailContent = '';

      if (type === 'appointment_emergency_cancellation') {
        const appointmentDate = new Date(data.appointment.startTime).toLocaleDateString();
        const appointmentTime = new Date(data.appointment.startTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        mockEmailContent = `
Dear ${data.patient?.firstName || 'Patient'},

IMPORTANT NOTICE: Your appointment scheduled for ${appointmentDate} at ${appointmentTime} has been CANCELLED due to an emergency situation.

Reason: ${data.reason || 'Doctor unavailability (emergency)'}

We sincerely apologize for any inconvenience this may cause.
`;

        if (data.alternatives && data.alternatives.length > 0) {
          mockEmailContent += `
We have identified the following alternative appointment slots:

${data.alternatives.map((slot, index) =>
  `Option ${index + 1}: ${new Date(slot.startTime).toLocaleDateString()} at ${new Date(slot.startTime).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
).join('\n')}

Please call our office as soon as possible to reschedule your appointment, or reply to this email with your preferred option number.
`;
        } else {
          mockEmailContent += `
Please contact our office at your earliest convenience to reschedule your appointment.
`;
        }

        mockEmailContent += `
Thank you for your understanding.

Healthcare Management Team
`;

        logger.info(`MOCK EMAIL CONTENT:\n${mockEmailContent}`);
      } else if (type === 'appointment_emergency_rescheduled') {
        const originalDate = new Date(data.originalAppointment.startTime).toLocaleDateString();
        const originalTime = new Date(data.originalAppointment.startTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const newDate = new Date(data.newAppointment.startTime).toLocaleDateString();
        const newTime = new Date(data.newAppointment.startTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        mockEmailContent = `
Dear ${data.patient?.firstName || 'Patient'},

IMPORTANT NOTICE: Your appointment has been rescheduled due to an emergency situation.

Your original appointment:
Date: ${originalDate}
Time: ${originalTime}
Provider: ${data.originalDoctor.name}

Your new appointment:
Date: ${newDate}
Time: ${newTime}
Provider: ${data.newDoctor.name}

This change has been made automatically to ensure you receive care as quickly as possible.

If this new appointment time does not work for you, please contact our office as soon as possible to discuss alternatives.

We sincerely apologize for any inconvenience this may cause and appreciate your understanding.

Healthcare Management Team
`;

        logger.info(`MOCK EMAIL CONTENT:\n${mockEmailContent}`);
      }

      if (config.NODE_ENV === 'production') {
        // const emailProvider = require('../config/emailProvider');
        // const emailTemplate = getEmailTemplateForType(type, data);
        // return await emailProvider.send({
        //   to,
        //   from: config.EMAIL_FROM,
        //   subject,
        //   text: emailTemplate.text,
        //   html: emailTemplate.html
        // });
      }

      return {
        success: true,
        message: `Patient notification email sent successfully to ${to}`,
      };
    } catch (error) {
      logger.error('Failed to send patient notification email', {
        error: error.message,
        email: to,
        type,
        subject,
      });
      throw new Error('Failed to send patient notification email');
    }
  },

  /**
   * Send appointment reminder email to patient
   * @param {Object} appointment - Appointment object with populated patient and doctor
   * @returns {Promise<Object>} Result of the email operation
   */
  sendAppointmentReminderEmail: async (appointment) => {
    try {
      if (!appointment.patient || !appointment.patient.email) {
        throw new Error('Patient data missing from appointment');
      }

      const to = appointment.patient.email;
      const subject = 'Upcoming Appointment Reminder';

      logger.info(`MOCK EMAIL: Appointment Reminder to ${to} - ${subject}`);
      logger.info(`MOCK EMAIL: Appointment Details: ${JSON.stringify({
        appointmentId: appointment._id,
        patientId: appointment.patient._id,
        doctorId: appointment.doctor._id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      })}`);

      if (config.NODE_ENV === 'production') {
        // const emailProvider = require('../config/emailProvider');
        // return await emailProvider.send({
        //   to,
        //   from: config.EMAIL_FROM,
        //   subject,
        //   text: `Dear ${appointment.patient.firstName},\n\nThis is a reminder of your upcoming appointment with Dr. ${appointment.doctor.user.lastName} on ${new Date(appointment.startTime).toLocaleString()}.\n\nPlease arrive 15 minutes before your scheduled appointment time.`,
        //   html: `
        //     <p>Dear ${appointment.patient.firstName},</p>
        //     <p>This is a reminder of your upcoming appointment with Dr. ${appointment.doctor.user.lastName} on ${new Date(appointment.startTime).toLocaleString()}.</p>
        //     <p>Please arrive 15 minutes before your scheduled appointment time.</p>
        //   `
        // });
      }

      return {
        success: true,
        message: `Appointment reminder email sent successfully to ${to}`,
      };
    } catch (error) {
      logger.error('Failed to send appointment reminder email', {
        error: error.message,
        appointmentId: appointment?._id,
      });
      throw new Error('Failed to send appointment reminder email');
    }
  }
  
};

module.exports = emailService;

const config = require('../config/config');
const logger = require('../utils/logger');
// const nodemailer = require('nodemailer');
const { NotificationError } = require('../utils/errors');
const moment = require('moment');

/**
 * Initialize email transporter based on environment
 */
let transporter;

if (config.NODE_ENV === 'production') {
  transporter = nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: config.EMAIL_PORT,
    secure: config.EMAIL_SECURE,
    auth: {
      user: config.EMAIL_USERNAME,
      pass: config.EMAIL_PASSWORD
    }
  });
} else {
  transporter = {
    sendMail: async (mailOptions) => {
      logger.info('MOCK EMAIL SENT', {
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text ? mailOptions.text.substring(0, 100) + '...' : null
      });
      return { messageId: `mock-${Date.now()}` };
    }
  };
}

const emailService = {
  /**
   * Send a general email
   */
  sendEmail: async (to, subject, text, html) => {
    try {
      const mailOptions = {
        from: `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_FROM}>`,
        to,
        subject,
        text,
        html: html || text
      };

      if (config.NODE_ENV === 'production') {
        const info = await transporter.sendMail(mailOptions);
        return {
          success: true,
          messageId: info.messageId
        };
      } else {
        logger.info(`MOCK EMAIL: To: ${to}, Subject: ${subject}`);
        logger.info(`MOCK EMAIL: Text content: ${text.substring(0, 100)}...`);
        return {
          success: true,
          message: `Email sent successfully to ${to}`,
          mock: true
        };
      }
    } catch (error) {
      logger.error('Failed to send email', {
        error: error.message,
        email: to,
        subject
      });
      throw new NotificationError('Failed to send email', 'EMAIL_SEND_FAILED');
    }
  },

  /**
   * Send password reset email
   */
  sendPasswordResetEmail: async (to, resetLink) => {
    try {
      const subject = 'Password Reset Request - Healthcare App';
      const html = `
        <div>
          <h2>Password Reset Request</h2>
          <p>You requested a password reset.</p>
          <p>Please click the button below to reset your password. This link will expire in 60 minutes.</p>
          <div style="margin: 25px 0;">
            <a href="${resetLink}">Reset Password</a>
          </div>
          <p>If you did not request this password reset, please ignore this email or contact support.</p>
          <p>Thank you,<br>Healthcare App Team</p>
        </div>
      `;
      const text = `
        You requested a password reset.
        Please click this link to reset your password: ${resetLink}
        This link expires in 60 minutes.
        If you did not request this password reset, please ignore this email or contact support.
        Thank you,
        Healthcare App Team
      `;
      return await emailService.sendEmail(to, subject, text, html);
    } catch (error) {
      logger.error('Failed to send password reset email', {
        error: error.message,
        email: to
      });
      throw new NotificationError('Failed to send password reset email', 'RESET_EMAIL_FAILED');
    }
  },

  /**
   * Send appointment confirmation email
   */
  sendAppointmentConfirmation: async (to, appointmentData) => {
    try {
      const subject = 'Appointment Confirmation - Healthcare App';
      const formattedData = {
        ...appointmentData,
        date: moment(appointmentData.startTime).format('dddd, MMMM D, YYYY'),
        startTime: moment(appointmentData.startTime).format('h:mm A'),
        endTime: moment(appointmentData.endTime).format('h:mm A'),
        viewLink: `${config.FRONTEND_URL}/appointments/${appointmentData._id}`,
        cancelLink: `${config.FRONTEND_URL}/appointments/${appointmentData._id}/cancel`
      };
      const html = `
        <div>
          <h2>Appointment Confirmation</h2>
          <p>Your appointment has been confirmed:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Doctor:</strong> Dr. ${appointmentData.doctorName}</p>
            <p><strong>Date:</strong> ${formattedData.date}</p>
            <p><strong>Time:</strong> ${formattedData.startTime} - ${formattedData.endTime}</p>
            <p><strong>Appointment Type:</strong> ${appointmentData.appointmentType}</p>
          </div>
          <div>
            <a href="${formattedData.viewLink}">View Appointment</a>
            <a href="${formattedData.cancelLink}">Cancel Appointment</a>
          </div>
          <p>Thank you,<br>Healthcare App Team</p>
        </div>
      `;
      const text = `
        Your appointment has been confirmed:
        Doctor: Dr. ${appointmentData.doctorName}
        Date: ${formattedData.date}
        Time: ${formattedData.startTime} - ${formattedData.endTime}
        Appointment Type: ${appointmentData.appointmentType}
        To view your appointment: ${formattedData.viewLink}
        To cancel your appointment: ${formattedData.cancelLink}
        Thank you,
        Healthcare App Team
      `;
      return await emailService.sendEmail(to, subject, text, html);
    } catch (error) {
      logger.error('Failed to send appointment confirmation email', {
        error: error.message,
        email: to
      });
      throw new NotificationError('Failed to send confirmation email', 'CONFIRMATION_EMAIL_FAILED');
    }
  },

  /**
   * Send appointment cancellation email
   */
  sendAppointmentCancellation: async (to, appointmentData) => {
    try {
      const subject = 'Appointment Cancellation - Healthcare App';
      const formattedData = {
        ...appointmentData,
        date: moment(appointmentData.startTime).format('dddd, MMMM D, YYYY'),
        startTime: moment(appointmentData.startTime).format('h:mm A'),
        endTime: moment(appointmentData.endTime).format('h:mm A'),
        bookAgainLink: `${config.FRONTEND_URL}/book`
      };
      const html = `
        <div>
          <h2>Appointment Cancellation</h2>
          <p>Your appointment has been cancelled:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Doctor:</strong> Dr. ${appointmentData.doctorName}</p>
            <p><strong>Date:</strong> ${formattedData.date}</p>
            <p><strong>Time:</strong> ${formattedData.startTime} - ${formattedData.endTime}</p>
            <p><strong>Reason:</strong> ${appointmentData.cancellationReason || 'Not specified'}</p>
          </div>
          <div>
            <a href="${formattedData.bookAgainLink}">Book Another Appointment</a>
          </div>
          <p>Thank you,<br>Healthcare App Team</p>
        </div>
      `;
      const text = `
        Your appointment has been cancelled:
        Doctor: Dr. ${appointmentData.doctorName}
        Date: ${formattedData.date}
        Time: ${formattedData.startTime} - ${formattedData.endTime}
        Reason: ${appointmentData.cancellationReason || 'Not specified'}
        To book another appointment: ${formattedData.bookAgainLink}
        Thank you,
        Healthcare App Team
      `;
      return await emailService.sendEmail(to, subject, text, html);
    } catch (error) {
      logger.error('Failed to send appointment cancellation email', {
        error: error.message,
        email: to
      });
      throw new NotificationError('Failed to send cancellation email', 'CANCELLATION_EMAIL_FAILED');
    }
  },

  /**
   * Send appointment rescheduled email
   */
  sendAppointmentRescheduled: async (to, appointmentData) => {
    try {
      const subject = 'Appointment Rescheduled - Healthcare App';
      const formattedData = {
        ...appointmentData,
        newDate: moment(appointmentData.startTime).format('dddd, MMMM D, YYYY'),
        newStartTime: moment(appointmentData.startTime).format('h:mm A'),
        newEndTime: moment(appointmentData.endTime).format('h:mm A'),
        oldDate: moment(appointmentData.previousStartTime).format('dddd, MMMM D, YYYY'),
        oldStartTime: moment(appointmentData.previousStartTime).format('h:mm A'),
        oldEndTime: moment(appointmentData.previousEndTime).format('h:mm A'),
        viewLink: `${config.FRONTEND_URL}/appointments/${appointmentData._id}`,
        cancelLink: `${config.FRONTEND_URL}/appointments/${appointmentData._id}/cancel`
      };
      const html = `
        <div>
          <h2>Appointment Rescheduled</h2>
          <p>Your appointment has been rescheduled:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Doctor:</strong> Dr. ${appointmentData.doctorName}</p>
            <p><strong>Appointment Type:</strong> ${appointmentData.appointmentType}</p>
            <p><strong>Previous Date:</strong> ${formattedData.oldDate}</p>
            <p><strong>Previous Time:</strong> ${formattedData.oldStartTime} - ${formattedData.oldEndTime}</p>
            <p>New Appointment:</p>
            <p><strong>New Date:</strong> ${formattedData.newDate}</p>
            <p><strong>New Time:</strong> ${formattedData.newStartTime} - ${formattedData.newEndTime}</p>
            <p><strong>Reason:</strong> ${appointmentData.rescheduleReason || 'Not specified'}</p>
          </div>
          <div>
            <a href="${formattedData.viewLink}">View Appointment</a>
            <a href="${formattedData.cancelLink}">Cancel Appointment</a>
          </div>
          <p>If this new time doesn't work for you, please cancel and reschedule at your convenience.</p>
          <p>Thank you,<br>Healthcare App Team</p>
        </div>
      `;
      const text = `
        Your appointment has been rescheduled:
        Doctor: Dr. ${appointmentData.doctorName}
        Appointment Type: ${appointmentData.appointmentType}
        Previous Date: ${formattedData.oldDate}
        Previous Time: ${formattedData.oldStartTime} - ${formattedData.oldEndTime}
        New Date: ${formattedData.newDate}
        New Time: ${formattedData.newStartTime} - ${formattedData.newEndTime}
        Reason: ${appointmentData.rescheduleReason || 'Not specified'}
        To view your appointment: ${formattedData.viewLink}
        To cancel your appointment: ${formattedData.cancelLink}
        If this new time doesn't work for you, please cancel and reschedule at your convenience.
        Thank you,
        Healthcare App Team
      `;
      return await emailService.sendEmail(to, subject, text, html);
    } catch (error) {
      logger.error('Failed to send appointment rescheduled email', {
        error: error.message,
        email: to
      });
      throw new NotificationError('Failed to send rescheduled notification email', 'RESCHEDULE_EMAIL_FAILED');
    }
  },

  /**
   * Send reminder email for upcoming appointment
   */
  sendAppointmentReminder: async (to, appointmentData) => {
    try {
      const subject = 'Appointment Reminder - Healthcare App';
      const formattedData = {
        ...appointmentData,
        date: moment(appointmentData.startTime).format('dddd, MMMM D, YYYY'),
        startTime: moment(appointmentData.startTime).format('h:mm A'),
        endTime: moment(appointmentData.endTime).format('h:mm A'),
        viewLink: `${config.FRONTEND_URL}/appointments/${appointmentData._id}`,
        cancelLink: `${config.FRONTEND_URL}/appointments/${appointmentData._id}/cancel`,
        rescheduleLink: `${config.FRONTEND_URL}/appointments/${appointmentData._id}/reschedule`
      };
      const html = `
        <div>
          <h2>Appointment Reminder</h2>
          <p>This is a reminder for your upcoming appointment:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p><strong>Doctor:</strong> Dr. ${appointmentData.doctorName}</p>
            <p><strong>Date:</strong> ${formattedData.date}</p>
            <p><strong>Time:</strong> ${formattedData.startTime} - ${formattedData.endTime}</p>
            <p><strong>Appointment Type:</strong> ${appointmentData.appointmentType}</p>
            <p><strong>Location:</strong> ${appointmentData.location || 'Main Office'}</p>
          </div>
          <div>
            <a href="${formattedData.viewLink}">View Appointment</a>
            <a href="${formattedData.rescheduleLink}">Reschedule</a>
            <a href="${formattedData.cancelLink}">Cancel</a>
          </div>
          <p>Please arrive 10 minutes before your appointment time.</p>
          <p>Thank you,<br>Healthcare App Team</p>
        </div>
      `;
      const text = `
        This is a reminder for your upcoming appointment:
        Doctor: Dr. ${appointmentData.doctorName}
        Date: ${formattedData.date}
        Time: ${formattedData.startTime} - ${formattedData.endTime}
        Appointment Type: ${appointmentData.appointmentType}
        Location: ${appointmentData.location || 'Main Office'}
        To view your appointment: ${formattedData.viewLink}
        To reschedule: ${formattedData.rescheduleLink}
        To cancel: ${formattedData.cancelLink}
        Please arrive 10 minutes before your appointment time.
        Thank you,
        Healthcare App Team
      `;
      return await emailService.sendEmail(to, subject, text, html);
    } catch (error) {
      logger.error('Failed to send appointment reminder email', {
        error: error.message,
        email: to
      });
      throw new NotificationError('Failed to send reminder email', 'REMINDER_EMAIL_FAILED');
    }
  }
  // Add more methods as needed...
};

module.exports = emailService;
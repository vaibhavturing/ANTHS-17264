// src/services/email.service.js

const config = require('../config/config');
const logger = require('../utils/logger');
const { BusinessLogicError } = require('../utils/errors');

/**
 * Email service for sending transactional emails 
 * in the Healthcare Management Application
 */
const emailService = {
  /**
   * Send a password reset email
   * @param {string} to - Recipient email address
   * @param {string} resetLink - Password reset link
   * @returns {Promise<Object>} Result of the email operation
   */
  sendPasswordResetEmail: async (to, resetLink) => {
    try {
      // In a real implementation, this would use an email service like SendGrid, Mailgun, etc.
      // For development, we'll log the email content

      logger.info(`MOCK EMAIL: Password Reset Requested for ${to}`);
      logger.info(`MOCK EMAIL: Reset link: ${resetLink}`);

      if (config.NODE_ENV === 'production') {
        // Example integration with an email provider (pseudocode)
        // const emailProvider = require('../config/emailProvider');
        // return await emailProvider.send({
        //   to,
        //   from: config.EMAIL_FROM,
        //   subject: 'Password Reset Request - Healthcare App',
        //   text: `You requested a password reset. Click this link to reset your password: ${resetLink}. This link expires in 60 minutes.`,
        //   html: `
        //     <p>You requested a password reset.</p>
        //     <p>Click <a href="${resetLink}">this link</a> to reset your password.</p>
        //     <p>This link expires in 60 minutes.</p>
        //   `
        // });
      }

      // Return success for development/testing
      return {
        success: true,
        message: `Password reset email sent successfully to ${to}`,
      };
    } catch (error) {
      logger.error('Failed to send password reset email', {
        error: error.message,
        email: to
      });
      throw new BusinessLogicError('Failed to send password reset email');
    }
  }
};

module.exports = emailService;

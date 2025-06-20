// src/workers/processors/appointment-reminder.processor.js
const Bull = require('bull');
const queueConfig = require('../../config/queue.config');
const logger = require('../../utils/logger');
const Appointment = require('../../models/appointment.model');
const Patient = require('../../models/patient.model');
const User = require('../../models/user.model');
const notificationService = require('../../services/notification.service');
const emailService = require('../../services/email.service');

// Initialize queue
const reminderQueue = new Bull(queueConfig.queues.APPOINTMENT_REMINDER, {
  redis: queueConfig.redis,
  defaultJobOptions: queueConfig.defaultJobOptions
});

/**
 * Process a single appointment reminder
 * @param {Object} appointment - Appointment document
 * @returns {Promise<void>}
 */
async function processAppointmentReminder(appointment) {
  try {
    // Get patient and doctor information
    const [patient, doctor] = await Promise.all([
      Patient.findById(appointment.patient).select('firstName lastName contactInformation').lean(),
      User.findById(appointment.doctor).select('firstName lastName').lean()
    ]);
    
    if (!patient || !doctor) {
      throw new Error(`Unable to find patient or doctor for appointment ${appointment._id}`);
    }
    
    // Format appointment date and time for display
    const appointmentDate = new Date(appointment.scheduledTime);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Send email reminder
    await emailService.sendEmail({
      to: patient.contactInformation.email,
      subject: 'Appointment Reminder',
      template: 'appointment-reminder',
      context: {
        patientName: `${patient.firstName} ${patient.lastName}`,
        doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        appointmentDate: formattedDate,
        appointmentTime: formattedTime,
        appointmentType: appointment.type,
        appointmentLocation: appointment.location,
        appointmentNotes: appointment.notes || 'No special instructions'
      }
    });
    
    // Send SMS reminder if patient has a phone number
    if (patient.contactInformation.phone) {
      await notificationService.sendSMS(
        patient.contactInformation.phone,
        `Reminder: You have an appointment with Dr. ${doctor.lastName} on ${formattedDate} at ${formattedTime}. Location: ${appointment.location}`
      );
    }
    
    // Mark appointment as having reminders sent
    await Appointment.findByIdAndUpdate(appointment._id, { 
      reminderSent: true,
      updatedAt: new Date()
    });
    
    logger.info(`Sent reminders for appointment ${appointment._id} to patient ${patient._id}`);
  } catch (error) {
    logger.error(`Error processing reminder for appointment ${appointment._id}:`, error);
    throw error;
  }
}

/**
 * Start the appointment reminder processor
 * @param {number} workerId - Worker ID
 */
function start(workerId) {
  // Process individual appointment reminders
  reminderQueue.process('single-reminder', queueConfig.concurrency.APPOINTMENT_REMINDER, async (job) => {
    logger.info(`Worker ${workerId} processing single appointment reminder job ${job.id}`);
    
    const appointmentId = job.data.appointmentId;
    
    try {
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        throw new Error(`Appointment ${appointmentId} not found`);
      }
      
      await processAppointmentReminder(appointment);
      
      return { success: true, appointmentId };
    } catch (error) {
      logger.error(`Error processing appointment reminder ${appointmentId}:`, error);
      throw error;
    }
  });
  
  // Process batch appointment reminders
  reminderQueue.process('batch-reminders', 1, async (job) => {
    logger.info(`Worker ${workerId} processing batch appointment reminders job ${job.id}`);
    
    const { days = 1, limit = 100 } = job.data;
    let processed = 0;
    let failed = 0;
    
    try {
      // Find appointments that need reminders
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      
      // Set time to beginning of the day
      const startTime = new Date(targetDate);
      startTime.setHours(0, 0, 0, 0);
      
      // Set time to end of the day
      const endTime = new Date(targetDate);
      endTime.setHours(23, 59, 59, 999);
      
      // Find appointments in the target date range that haven't had reminders sent
      const appointments = await Appointment.find({
        scheduledTime: { $gte: startTime, $lte: endTime },
        status: 'scheduled',
        reminderSent: { $ne: true }
      })
      .limit(limit)
      .lean();
      
      logger.info(`Found ${appointments.length} appointments for reminders`);
      
      // Process each appointment
      for (const appointment of appointments) {
        try {
          await processAppointmentReminder(appointment);
          processed++;
          
          // Update progress
          await job.progress(Math.floor((processed / appointments.length) * 100));
        } catch (error) {
          failed++;
          logger.error(`Failed to send reminder for appointment ${appointment._id}:`, error);
        }
      }
      
      return {
        success: true,
        total: appointments.length,
        processed,
        failed,
        targetDate: targetDate.toISOString().split('T')[0]
      };
    } catch (error) {
      logger.error(`Error in batch reminder job ${job.id}:`, error);
      throw error;
    }
  });
  
  // Handle completed jobs
  reminderQueue.on('completed', (job, result) => {
    logger.info(`Worker ${workerId} completed job ${job.id} with result:`, result);
  });
  
  // Handle failed jobs
  reminderQueue.on('failed', (job, error) => {
    logger.error(`Worker ${workerId} job ${job.id} failed:`, error);
  });
  
  logger.info(`Worker ${workerId} started appointment reminder processor`);
}

/**
 * Stop the appointment reminder processor
 */
async function stop() {
  await reminderQueue.close();
}

module.exports = {
  queue: reminderQueue,
  start,
  stop
};
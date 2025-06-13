const Appointment = require('../models/appointment.model');
const Patient = require('../models/patient.model');
const Doctor = require('../models/doctor.model');
const AppointmentType = require('../models/appointmentType.model');
const scheduleService = require('./schedule.service');
const emailService = require('./email.service');
const notificationService = require('./notification.service');
const availabilityService = require('./availability.service');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for managing appointments
 */
const appointmentService = {
  /**
   * Create a new appointment
   * @param {Object} appointmentData - Appointment data
   * @returns {Promise<Object>} Created appointment
   */
  createAppointment: async (appointmentData) => {
    try {
      // Verify patient exists
      const patientExists = await Patient.exists({ _id: appointmentData.patient });
      if (!patientExists) {
        throw new NotFoundError('Patient not found');
      }
      
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: appointmentData.doctor });
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Verify appointment type exists
      const appointmentType = await AppointmentType.findById(appointmentData.appointmentType);
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }
      
      // Get doctor-specific settings
      const settings = appointmentType.getSettingsForDoctor(appointmentData.doctor);
      
      // Override duration and buffer time with doctor-specific settings if available
      appointmentData.duration = settings.duration;
      appointmentData.bufferTime = settings.bufferTime;
      
      // Set virtual meeting flag based on appointment type
      appointmentData.isVirtual = appointmentType.isVirtual;
      
      // Calculate end time
      const startTime = new Date(appointmentData.startTime);
      const durationMs = appointmentData.duration * 60 * 1000;
      appointmentData.endTime = new Date(startTime.getTime() + durationMs);
      
      // NEW: Check if doctor is available on this date (taking leaves into account)
      const dateStr = startTime.toISOString().split('T')[0];
      const startTimeStr = startTime.getHours().toString().padStart(2, '0') + ':' + 
                          startTime.getMinutes().toString().padStart(2, '0');
      const endTimeStr = new Date(appointmentData.endTime).getHours().toString().padStart(2, '0') + ':' + 
                        new Date(appointmentData.endTime).getMinutes().toString().padStart(2, '0');
                           
      const isDoctorAvailable = await availabilityService.isDoctorAvailable(
        appointmentData.doctor,
        new Date(dateStr),
        startTimeStr,
        endTimeStr
      );
      
      if (!isDoctorAvailable) {
        throw new ValidationError('Doctor is not available at this time due to leave or working hours');
      }
      
      // Check if the time slot is available
      const isAvailable = await scheduleService.checkTimeSlotAvailability(
        appointmentData.doctor,
        startTime,
        appointmentData.duration,
        appointmentData.appointmentType
      );
      
      if (!isAvailable) {
        throw new ValidationError('This time slot is not available');
      }
      
      // Create appointment
      const appointment = new Appointment(appointmentData);
      await appointment.save();
      
      // Send confirmation email to patient (in a real app)
      try {
        const patient = await Patient.findById(appointmentData.patient);
        const doctor = await Doctor.findById(appointmentData.doctor)
          .populate('user', 'firstName lastName');
          
        // This is a mock example, would be implemented with real email service
        await emailService.sendPatientNotificationEmail(
          patient.email,
          'appointment_confirmation',
          'Your Appointment Confirmation',
          {
            appointment,
            patient,
            doctor,
            appointmentType
          }
        );
      } catch (emailError) {
        logger.error('Error sending appointment confirmation email', {
          error: emailError.message,
          appointmentId: appointment._id
        });
        // Don't throw here, as the main functionality has succeeded
      }
      
      logger.info('Created appointment', { 
        appointmentId: appointment._id,
        patientId: appointment.patient,
        doctorId: appointment.doctor
      });
      
      return appointment;
    } catch (error) {
      logger.error('Error creating appointment', { 
        error: error.message,
        appointmentData 
      });
      throw error;
    }
  }
  
  // Other appointment service methods would go here...
};

module.exports = appointmentService;
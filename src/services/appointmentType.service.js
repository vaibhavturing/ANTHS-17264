const AppointmentType = require('../models/appointmentType.model');
const Doctor = require('../models/doctor.model');
const logger = require('../utils/logger');
const { NotFoundError, ValidationError } = require('../utils/errors');

/**
 * Service for managing appointment types
 */
const appointmentTypeService = {
  /**
   * Create a new appointment type
   * @param {Object} data - Appointment type data
   * @returns {Promise<Object>} Created appointment type
   */
  createAppointmentType: async (data) => {
    try {
      logger.info('Creating new appointment type', { 
        name: data.name, 
        duration: data.duration 
      });
      
      const appointmentType = new AppointmentType(data);
      await appointmentType.save();
      
      logger.info('Successfully created appointment type', { id: appointmentType._id });
      return appointmentType;
    } catch (error) {
      logger.error('Error creating appointment type', { 
        error: error.message,
        data 
      });
      throw error;
    }
  },

  /**
   * Get all appointment types
   * @param {Object} filter - Optional filter criteria
   * @returns {Promise<Array>} List of appointment types
   */
  getAllAppointmentTypes: async (filter = {}) => {
    try {
      const appointmentTypes = await AppointmentType.find(filter)
        .sort({ name: 1 });
      
      return appointmentTypes;
    } catch (error) {
      logger.error('Error fetching appointment types', { error: error.message });
      throw error;
    }
  },

  /**
   * Get appointment type by ID
   * @param {string} id - Appointment type ID
   * @returns {Promise<Object>} Appointment type
   */
  getAppointmentTypeById: async (id) => {
    try {
      const appointmentType = await AppointmentType.findById(id);
      
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }
      
      return appointmentType;
    } catch (error) {
      logger.error('Error fetching appointment type', { 
        error: error.message,
        id 
      });
      throw error;
    }
  },

  /**
   * Update appointment type
   * @param {string} id - Appointment type ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated appointment type
   */
  updateAppointmentType: async (id, updates) => {
    try {
      const appointmentType = await AppointmentType.findById(id);
      
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }
      
      // Apply updates
      Object.keys(updates).forEach(key => {
        appointmentType[key] = updates[key];
      });
      
      await appointmentType.save();
      
      logger.info('Successfully updated appointment type', { id });
      return appointmentType;
    } catch (error) {
      logger.error('Error updating appointment type', { 
        error: error.message,
        id,
        updates 
      });
      throw error;
    }
  },

  /**
   * Delete appointment type
   * @param {string} id - Appointment type ID
   * @returns {Promise<Object>} Deletion result
   */
  deleteAppointmentType: async (id) => {
    try {
      const result = await AppointmentType.deleteOne({ _id: id });
      
      if (result.deletedCount === 0) {
        throw new NotFoundError('Appointment type not found');
      }
      
      logger.info('Successfully deleted appointment type', { id });
      return { success: true };
    } catch (error) {
      logger.error('Error deleting appointment type', { 
        error: error.message,
        id 
      });
      throw error;
    }
  },

  /**
   * Get appointment types for a specific doctor
   * @param {string} doctorId - Doctor ID
   * @param {boolean} activeOnly - Whether to fetch only active appointment types
   * @returns {Promise<Array>} List of appointment types with doctor-specific settings
   */
  getAppointmentTypesForDoctor: async (doctorId, activeOnly = true) => {
    try {
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Get appointment types
      if (activeOnly) {
        return await AppointmentType.findActiveForDoctor(doctorId);
      } else {
        const allTypes = await AppointmentType.find();
        
        // Process each type to include doctor settings
        return allTypes.map(type => {
          const settings = type.getSettingsForDoctor(doctorId);
          return {
            _id: type._id,
            name: type.name,
            description: type.description,
            color: type.color,
            duration: settings.duration,
            bufferTime: settings.bufferTime,
            isVirtual: type.isVirtual,
            isActive: settings.isActive,
            preparationInstructions: settings.preparationInstructions
          };
        });
      }
    } catch (error) {
      logger.error('Error fetching appointment types for doctor', { 
        error: error.message,
        doctorId,
        activeOnly
      });
      throw error;
    }
  },

  /**
   * Update doctor-specific settings for an appointment type
   * @param {string} id - Appointment type ID
   * @param {string} doctorId - Doctor ID
   * @param {Object} settings - Doctor-specific settings
   * @returns {Promise<Object>} Updated appointment type
   */
  updateDoctorSettings: async (id, doctorId, settings) => {
    try {
      const appointmentType = await AppointmentType.findById(id);
      
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }
      
      // Verify doctor exists
      const doctorExists = await Doctor.exists({ _id: doctorId });
      
      if (!doctorExists) {
        throw new NotFoundError('Doctor not found');
      }
      
      // Validate settings
      if (settings.duration && (settings.duration < 5 || settings.duration > 240)) {
        throw new ValidationError('Duration must be between 5 and 240 minutes');
      }
      
      if (settings.bufferTime && (settings.bufferTime < 0 || settings.bufferTime > 60)) {
        throw new ValidationError('Buffer time must be between 0 and 60 minutes');
      }
      
      // Find existing doctor settings or create new one
      const existingSettingIndex = appointmentType.doctorSettings.findIndex(
        setting => setting.doctorId.toString() === doctorId.toString()
      );
      
      if (existingSettingIndex >= 0) {
        // Update existing settings
        Object.keys(settings).forEach(key => {
          appointmentType.doctorSettings[existingSettingIndex][key] = settings[key];
        });
      } else {
        // Add new doctor settings
        appointmentType.doctorSettings.push({
          doctorId,
          ...settings
        });
      }
      
      await appointmentType.save();
      
      logger.info('Successfully updated doctor settings for appointment type', { id, doctorId });
      return appointmentType;
    } catch (error) {
      logger.error('Error updating doctor settings for appointment type', { 
        error: error.message,
        id,
        doctorId,
        settings 
      });
      throw error;
    }
  }
};

module.exports = appointmentTypeService;
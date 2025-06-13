const AppointmentType = require('../models/appointmentType.model');
const logger = require('../utils/logger');
const { BadRequestError, NotFoundError } = require('../utils/errors');

/**
 * Service for managing appointment types in the Healthcare Management Application
 */
const appointmentTypeService = {
  /**
   * Create a new appointment type
   * @param {Object} data - Appointment type data
   * @returns {Promise<Object>} Created appointment type
   */
  createAppointmentType: async (data) => {
    try {
      logger.info('Creating new appointment type', { typeName: data.name });
      
      // Check if appointment type with same name already exists
      const existingType = await AppointmentType.findOne({ name: data.name });
      if (existingType) {
        throw new BadRequestError('Appointment type with this name already exists');
      }
      
      const appointmentType = new AppointmentType(data);
      await appointmentType.save();
      
      logger.info('Successfully created appointment type', { 
        typeId: appointmentType._id,
        typeName: appointmentType.name
      });
      
      return appointmentType;
    } catch (error) {
      logger.error('Failed to create appointment type', { 
        error: error.message, 
        typeName: data.name 
      });
      throw error;
    }
  },
  
  /**
   * Get all appointment types
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of appointment types
   */
  getAppointmentTypes: async (filters = {}) => {
    try {
      const query = { ...filters };
      
      // Default to active appointment types only, unless explicitly specified
      if (query.isActive === undefined) {
        query.isActive = true;
      }
      
      logger.info('Fetching appointment types', { filters: query });
      
      const appointmentTypes = await AppointmentType.find(query)
        .sort({ name: 1 })
        .populate('availableDoctors', 'firstName lastName email');
      
      logger.info('Successfully fetched appointment types', { 
        count: appointmentTypes.length 
      });
      
      return appointmentTypes;
    } catch (error) {
      logger.error('Failed to fetch appointment types', { 
        error: error.message
      });
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
      logger.info('Fetching appointment type by ID', { typeId: id });
      
      const appointmentType = await AppointmentType.findById(id)
        .populate('availableDoctors', 'firstName lastName email');
      
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }
      
      logger.info('Successfully fetched appointment type', { 
        typeId: id,
        typeName: appointmentType.name
      });
      
      return appointmentType;
    } catch (error) {
      logger.error('Failed to fetch appointment type', { 
        error: error.message,
        typeId: id
      });
      throw error;
    }
  },
  
  /**
   * Update appointment type
   * @param {string} id - Appointment type ID
   * @param {Object} data - Updated appointment type data
   * @returns {Promise<Object>} Updated appointment type
   */
  updateAppointmentType: async (id, data) => {
    try {
      logger.info('Updating appointment type', { typeId: id });
      
      const appointmentType = await AppointmentType.findById(id);
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }
      
      // If name is being changed, check for duplicates
      if (data.name && data.name !== appointmentType.name) {
        const existingType = await AppointmentType.findOne({ 
          name: data.name,
          _id: { $ne: id }
        });
        
        if (existingType) {
          throw new BadRequestError('Another appointment type with this name already exists');
        }
      }
      
      // Update fields
      Object.assign(appointmentType, data);
      await appointmentType.save();
      
      logger.info('Successfully updated appointment type', { 
        typeId: id,
        typeName: appointmentType.name
      });
      
      return appointmentType;
    } catch (error) {
      logger.error('Failed to update appointment type', { 
        error: error.message,
        typeId: id
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
      logger.info('Deleting appointment type', { typeId: id });
      
      const appointmentType = await AppointmentType.findById(id);
      if (!appointmentType) {
        throw new NotFoundError('Appointment type not found');
      }
      
      // Soft delete by setting isActive to false
      appointmentType.isActive = false;
      await appointmentType.save();
      
      logger.info('Successfully soft-deleted appointment type', { 
        typeId: id,
        typeName: appointmentType.name
      });
      
      return { success: true, message: 'Appointment type deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete appointment type', { 
        error: error.message,
        typeId: id
      });
      throw error;
    }
  },
  
  /**
   * Get appointment types for a specific doctor
   * @param {string} doctorId - Doctor user ID
   * @returns {Promise<Array>} List of appointment types available for the doctor
   */
  getAppointmentTypesForDoctor: async (doctorId) => {
    try {
      logger.info('Fetching appointment types for doctor', { doctorId });
      
      const appointmentTypes = await AppointmentType.find({
        isActive: true,
        $or: [
          { availableDoctors: { $size: 0 } }, // Available to all doctors
          { availableDoctors: doctorId } // Specifically available to this doctor
        ]
      }).sort({ name: 1 });
      
      logger.info('Successfully fetched appointment types for doctor', { 
        doctorId,
        count: appointmentTypes.length 
      });
      
      return appointmentTypes;
    } catch (error) {
      logger.error('Failed to fetch appointment types for doctor', { 
        error: error.message,
        doctorId
      });
      throw error;
    }
  },
  
  /**
   * Initialize default appointment types in the system
   * @returns {Promise<Array>} Created default appointment types
   */
  initializeDefaultTypes: async () => {
    try {
      logger.info('Initializing default appointment types');
      
      // Check if we already have types in the system
      const existingCount = await AppointmentType.countDocuments();
      if (existingCount > 0) {
        logger.info('Appointment types already exist, skipping initialization');
        return { message: 'Appointment types already initialized' };
      }
      
      // Define default appointment types
      const defaultTypes = [
        {
          name: 'New Patient',
          description: 'Initial consultation for new patients',
          duration: 45,
          bufferTime: 5,
          requirements: ['Complete registration form', 'Bring ID and insurance card'],
          isNewPatient: true,
          color: '#27ae60' // Green
        },
        {
          name: 'Follow-Up',
          description: 'Follow-up appointment for existing patients',
          duration: 15,
          bufferTime: 5,
          requirements: ['Bring updated medication list'],
          color: '#3498db' // Blue
        },
        {
          name: 'Telehealth',
          description: 'Virtual appointment via video conference',
          duration: 20,
          bufferTime: 0,
          requirements: ['Stable internet connection', 'Quiet private space'],
          requiresVideoLink: true,
          color: '#9b59b6' // Purple
        },
        {
          name: 'Annual Physical',
          description: 'Comprehensive yearly physical examination',
          duration: 60,
          bufferTime: 10,
          requirements: ['Fasting for 8 hours prior', 'Wear comfortable clothing'],
          color: '#f39c12' // Orange
        }
      ];
      
      // Insert all default types
      const createdTypes = await AppointmentType.insertMany(defaultTypes);
      
      logger.info('Successfully initialized default appointment types', { 
        count: createdTypes.length 
      });
      
      return createdTypes;
    } catch (error) {
      logger.error('Failed to initialize default appointment types', { 
        error: error.message 
      });
      throw error;
    }
  }
};

module.exports = appointmentTypeService;
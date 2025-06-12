// File: src/services/appointmentType.service.js
const AppointmentType = require('../models/appointmentType.model');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { ApiError } = require('../utils/errors');

/**
 * Appointment Type Service
 * Handles creation and management of appointment types 
 */
const appointmentTypeService = {
  /**
   * Create a new appointment type
   * @param {Object} typeData - The appointment type data
   * @returns {Promise<Object>} Created appointment type
   */
  createAppointmentType: async (typeData) => {
    try {
      const appointmentType = new AppointmentType(typeData);
      await appointmentType.save();
      
      logger.info('Created new appointment type', {
        name: appointmentType.name,
        duration: appointmentType.duration,
        typeId: appointmentType._id
      });
      
      return appointmentType;
    } catch (error) {
      logger.error('Failed to create appointment type', {
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Update an appointment type
   * @param {string} typeId - The appointment type ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated appointment type
   */
  updateAppointmentType: async (typeId, updateData) => {
    try {
      const appointmentType = await AppointmentType.findById(typeId);
      
      if (!appointmentType) {
        throw new ApiError('Appointment type not found', 404);
      }
      
      // Apply updates
      Object.keys(updateData).forEach(key => {
        appointmentType[key] = updateData[key];
      });
      
      await appointmentType.save();
      
      logger.info('Updated appointment type', {
        typeId,
        name: appointmentType.name
      });
      
      return appointmentType;
    } catch (error) {
      logger.error('Failed to update appointment type', {
        typeId,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Get appointment type by ID
   * @param {string} typeId - The appointment type ID
   * @returns {Promise<Object>} Appointment type
   */
  getAppointmentTypeById: async (typeId) => {
    try {
      const appointmentType = await AppointmentType.findById(typeId);
      
      if (!appointmentType) {
        throw new ApiError('Appointment type not found', 404);
      }
      
      return appointmentType;
    } catch (error) {
      logger.error('Failed to get appointment type', {
        typeId,
        error: error.message
      });
      throw error;
    }
  },
  
  /**
   * Get all appointment types with optional filtering
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of appointment types
   */
  getAllAppointmentTypes: async (filters = {}) => {
    try {
      const query = {};
      
      // Apply status filter
      if (filters.status) {
        query.status = filters.status;
      }
      
      // Apply department filter
      if (filters.department) {
        query.department = filters.department;
      }
      
      // Apply minimum/maximum duration filters
      if (filters.minDuration) {
        query.duration = { $gte: filters.minDuration };
      }
      
      if (filters.maxDuration) {
        if (query.duration) {
          query.duration.$lte = filters.maxDuration;
        } else {
          query.duration = { $lte: filters.maxDuration };
        }
      }
      
      // Apply online bookable filter
      if (filters.isOnlineBookable !== undefined) {
        query.isOnlineBookable = filters.isOnlineBookable;
      }
      
      const appointmentTypes = await AppointmentType.find(query)
        .populate('department', 'name')
        .sort('name');
      
      return appointmentTypes;
    } catch (error) {
      logger.error('Failed to get appointment types', {
        filters,
        error: error.message
      });
      throw new ApiError('Failed to retrieve appointment types', 500, error.message);
    }
  },
  
  /**
   * Get appointment types for a department
   * @param {string} departmentId - The department ID
   * @param {boolean} activeOnly - Whether to return active types only
   * @returns {Promise<Array>} List of appointment types
   */
  getAppointmentTypesByDepartment: async (departmentId, activeOnly = true) => {
    try {
      const query = { department: departmentId };
      
      if (activeOnly) {
        query.status = 'active';
      }
      
      const types = await AppointmentType.find(query).sort('name');
      
      return types;
    } catch (error) {
      logger.error('Failed to get appointment types for department', {
        departmentId,
        error: error.message
      });
      throw new ApiError('Failed to retrieve department appointment types', 500, error.message);
    }
  },
  
  /**
   * Toggle appointment type status (active/inactive)
   * @param {string} typeId - The appointment type ID
   * @param {string} status - The new status
   * @returns {Promise<Object>} Updated appointment type
   */
  toggleAppointmentTypeStatus: async (typeId, status) => {
    try {
      if (!['active', 'inactive'].includes(status)) {
        throw new ApiError('Invalid status. Must be "active" or "inactive"', 400);
      }
      
      const appointmentType = await AppointmentType.findById(typeId);
      
      if (!appointmentType) {
        throw new ApiError('Appointment type not found', 404);
      }
      
      appointmentType.status = status;
      await appointmentType.save();
      
      logger.info(`Appointment type status changed to ${status}`, {
        typeId,
        name: appointmentType.name
      });
      
      return appointmentType;
    } catch (error) {
      logger.error('Failed to toggle appointment type status', {
        typeId,
        status,
        error: error.message
      });
      throw error;
    }
  }
};

module.exports = appointmentTypeService;
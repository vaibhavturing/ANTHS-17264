// src/controllers/location.controller.js
const locationService = require('../services/location.service');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Controller for location operations
 */
const locationController = {
  /**
   * Get all locations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getAllLocations: async (req, res, next) => {
    try {
      // Check if we should force refresh the cache
      const forceRefresh = req.query.refresh === 'true';
      
      const locations = await locationService.getAllLocations(forceRefresh);
      
      res.status(200).json({
        success: true,
        count: locations.length,
        data: locations
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get location by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getLocationById: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid location ID format');
      }
      
      // Check if we should force refresh the cache
      const forceRefresh = req.query.refresh === 'true';
      
      const location = await locationService.getLocationById(id, forceRefresh);
      
      res.status(200).json({
        success: true,
        data: location
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  },
  
  /**
   * Get locations by service
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getLocationsByService: async (req, res, next) => {
    try {
      const { service } = req.params;
      
      if (!service) {
        throw new BadRequestError('Service parameter is required');
      }
      
      // Check if we should force refresh the cache
      const forceRefresh = req.query.refresh === 'true';
      
      const locations = await locationService.getLocationsByService(service, forceRefresh);
      
      res.status(200).json({
        success: true,
        count: locations.length,
        data: locations
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get locations by region
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getLocationsByRegion: async (req, res, next) => {
    try {
      const { city, state } = req.query;
      
      if (!city && !state) {
        throw new BadRequestError('Either city or state parameter is required');
      }
      
      // Check if we should force refresh the cache
      const forceRefresh = req.query.refresh === 'true';
      
      const locations = await locationService.getLocationsByRegion({ city, state }, forceRefresh);
      
      res.status(200).json({
        success: true,
        count: locations.length,
        data: locations
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get all available services
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  getAllServices: async (req, res, next) => {
    try {
      // Check if we should force refresh the cache
      const forceRefresh = req.query.refresh === 'true';
      
      const services = await locationService.getAllServices(forceRefresh);
      
      res.status(200).json({
        success: true,
        count: services.length,
        data: services
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Create a new location
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  createLocation: async (req, res, next) => {
    try {
      const locationData = req.body;
      
      const location = await locationService.createLocation(locationData);
      
      res.status(201).json({
        success: true,
        data: location
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update location
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  updateLocation: async (req, res, next) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid location ID format');
      }
      
      const location = await locationService.updateLocation(id, updateData);
      
      res.status(200).json({
        success: true,
        data: location
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  },
  
  /**
   * Delete location
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  deleteLocation: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid location ID format');
      }
      
      await locationService.deleteLocation(id);
      
      res.status(200).json({
        success: true,
        message: 'Location deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }
};

module.exports = locationController;
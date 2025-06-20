// src/services/location.service.js
const Location = require('../models/location.model');
const cacheService = require('./cache.service');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { NotFoundError } = require('../utils/errors');

// Cache key prefixes
const CACHE_KEYS = {
  ALL_LOCATIONS: 'static:locations:all',
  LOCATION_BY_ID: 'static:location:id',
  LOCATIONS_BY_SERVICE: 'static:locations:service',
  LOCATIONS_BY_REGION: 'static:locations:region',
  LOCATION_SERVICES: 'static:location:services'
};

/**
 * Service for location operations
 */
const locationService = {
  /**
   * Get all active clinic locations
   * @param {boolean} forceRefresh - Force refresh of cached data
   * @returns {Promise<Array>} List of all locations
   */
  getAllLocations: async (forceRefresh = false) => {
    const fetchFn = async () => {
      logger.info('Fetching all locations from database');
      return await Location.find({ isActive: true })
        .select('name address contactInfo operatingHours services coordinates imageUrl')
        .lean();
    };
    
    if (forceRefresh) {
      return await cacheService.refreshStatic(CACHE_KEYS.ALL_LOCATIONS, fetchFn);
    } else {
      return await cacheService.getOrSetStatic(CACHE_KEYS.ALL_LOCATIONS, fetchFn);
    }
  },
  
  /**
   * Get location by ID
   * @param {string} id - Location ID
   * @param {boolean} forceRefresh - Force refresh of cached data
   * @returns {Promise<Object>} Location details
   */
  getLocationById: async (id, forceRefresh = false) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid location ID format');
    }
    
    const cacheKey = `${CACHE_KEYS.LOCATION_BY_ID}:${id}`;
    
    const fetchFn = async () => {
      logger.info(`Fetching location with ID ${id} from database`);
      const location = await Location.findById(id).lean();
      if (!location) {
        throw new NotFoundError('Location not found');
      }
      return location;
    };
    
    if (forceRefresh) {
      return await cacheService.refreshStatic(cacheKey, fetchFn);
    } else {
      return await cacheService.getOrSetStatic(cacheKey, fetchFn);
    }
  },
  
  /**
   * Get locations by service
   * @param {string} service - Service name
   * @param {boolean} forceRefresh - Force refresh of cached data
   * @returns {Promise<Array>} List of locations offering the service
   */
  getLocationsByService: async (service, forceRefresh = false) => {
    const cacheKey = `${CACHE_KEYS.LOCATIONS_BY_SERVICE}:${service}`;
    
    const fetchFn = async () => {
      logger.info(`Fetching locations offering "${service}" from database`);
      return await Location.find({ 
        services: service,
        isActive: true 
      })
      .select('name address contactInfo services coordinates')
      .lean();
    };
    
    if (forceRefresh) {
      return await cacheService.refreshStatic(cacheKey, fetchFn);
    } else {
      return await cacheService.getOrSetStatic(cacheKey, fetchFn);
    }
  },
  
  /**
   * Get locations by region (city/state)
   * @param {Object} region - Region object with city and/or state
   * @param {boolean} forceRefresh - Force refresh of cached data
   * @returns {Promise<Array>} List of locations in the region
   */
  getLocationsByRegion: async (region, forceRefresh = false) => {
    const { city, state } = region;
    const filter = { isActive: true };
    
    if (city) filter['address.city'] = city;
    if (state) filter['address.state'] = state;
    
    const cacheKey = `${CACHE_KEYS.LOCATIONS_BY_REGION}:${city || ''}:${state || ''}`;
    
    const fetchFn = async () => {
      logger.info(`Fetching locations in ${city || ''}, ${state || ''} from database`);
      return await Location.find(filter)
        .select('name address contactInfo services coordinates')
        .lean();
    };
    
    if (forceRefresh) {
      return await cacheService.refreshStatic(cacheKey, fetchFn);
    } else {
      return await cacheService.getOrSetStatic(cacheKey, fetchFn);
    }
  },
  
  /**
   * Get all available services across locations
   * @param {boolean} forceRefresh - Force refresh of cached data
   * @returns {Promise<Array>} List of unique services
   */
  getAllServices: async (forceRefresh = false) => {
    const fetchFn = async () => {
      logger.info('Fetching all unique services from database');
      
      const result = await Location.aggregate([
        { $match: { isActive: true } },
        { $unwind: '$services' },
        { $group: { _id: '$services' } },
        { $sort: { _id: 1 } }
      ]);
      
      return result.map(item => item._id);
    };
    
    if (forceRefresh) {
      return await cacheService.refreshStatic(CACHE_KEYS.LOCATION_SERVICES, fetchFn);
    } else {
      return await cacheService.getOrSetStatic(CACHE_KEYS.LOCATION_SERVICES, fetchFn);
    }
  },
  
  /**
   * Create a new location
   * @param {Object} locationData - Location data
   * @returns {Promise<Object>} Created location
   */
  createLocation: async (locationData) => {
    try {
      logger.info('Creating new location');
      
      const location = new Location(locationData);
      const savedLocation = await location.save();
      
      // Clear all location-related caches after creation
      await locationService.invalidateLocationCache();
      
      return savedLocation;
    } catch (error) {
      logger.error('Error creating location:', error);
      throw error;
    }
  },
  
  /**
   * Update location
   * @param {string} id - Location ID
   * @param {Object} updateData - Updated location data
   * @returns {Promise<Object>} Updated location
   */
  updateLocation: async (id, updateData) => {
    try {
      logger.info(`Updating location with ID ${id}`);
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid location ID format');
      }
      
      const location = await Location.findById(id);
      if (!location) {
        throw new NotFoundError('Location not found');
      }
      
      // Update fields
      Object.keys(updateData).forEach(key => {
        location[key] = updateData[key];
      });
      
      // Update timestamp
      location.updatedAt = new Date();
      
      const updatedLocation = await location.save();
      
      // Invalidate specific location cache
      await cacheService.delete(`${CACHE_KEYS.LOCATION_BY_ID}:${id}`);
      
      // Invalidate other potentially affected caches
      await locationService.invalidateLocationCache();
      
      return updatedLocation;
    } catch (error) {
      logger.error(`Error updating location ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Delete location (soft delete)
   * @param {string} id - Location ID
   * @returns {Promise<Object>} Deleted location
   */
  deleteLocation: async (id) => {
    try {
      logger.info(`Soft deleting location with ID ${id}`);
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid location ID format');
      }
      
      const location = await Location.findById(id);
      if (!location) {
        throw new NotFoundError('Location not found');
      }
      
      // Soft delete by setting isActive to false
      location.isActive = false;
      location.updatedAt = new Date();
      
      const deletedLocation = await location.save();
      
      // Invalidate caches
      await locationService.invalidateLocationCache();
      
      return deletedLocation;
    } catch (error) {
      logger.error(`Error deleting location ${id}:`, error);
      throw error;
    }
  },
  
  /**
   * Invalidate all location-related caches
   * @returns {Promise<void>}
   */
  invalidateLocationCache: async () => {
    logger.info('Invalidating location cache');
    
    try {
      // Clear all location-related caches
      await Promise.all([
        cacheService.delete(CACHE_KEYS.ALL_LOCATIONS),
        cacheService.delete(CACHE_KEYS.LOCATION_SERVICES),
        cacheService.clearPattern(`${CACHE_KEYS.LOCATION_BY_ID}:*`),
        cacheService.clearPattern(`${CACHE_KEYS.LOCATIONS_BY_SERVICE}:*`),
        cacheService.clearPattern(`${CACHE_KEYS.LOCATIONS_BY_REGION}:*`)
      ]);
      
      logger.info('Location cache invalidated successfully');
    } catch (error) {
      logger.error('Error invalidating location cache:', error);
      // Don't throw - cache invalidation failures shouldn't affect the main operation
    }
  }
};

module.exports = locationService;
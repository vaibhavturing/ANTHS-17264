const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { NotFoundError, BadRequestError } = require('../utils/errors');

// Define a simple in-memory holiday cache
// In a real application, this would be a database model
let holidayCache = [
  // US Federal Holidays for 2023
  { date: new Date('2023-01-01'), name: "New Year's Day", country: 'US' },
  { date: new Date('2023-01-16'), name: "Martin Luther King Jr. Day", country: 'US' },
  { date: new Date('2023-02-20'), name: "Presidents' Day", country: 'US' },
  { date: new Date('2023-05-29'), name: "Memorial Day", country: 'US' },
  { date: new Date('2023-06-19'), name: "Juneteenth", country: 'US' },
  { date: new Date('2023-07-04'), name: "Independence Day", country: 'US' },
  { date: new Date('2023-09-04'), name: "Labor Day", country: 'US' },
  { date: new Date('2023-10-09'), name: "Columbus Day", country: 'US' },
  { date: new Date('2023-11-11'), name: "Veterans Day", country: 'US' },
  { date: new Date('2023-11-23'), name: "Thanksgiving Day", country: 'US' },
  { date: new Date('2023-12-25'), name: "Christmas Day", country: 'US' },
  
  // US Federal Holidays for 2024
  { date: new Date('2024-01-01'), name: "New Year's Day", country: 'US' },
  { date: new Date('2024-01-15'), name: "Martin Luther King Jr. Day", country: 'US' },
  { date: new Date('2024-02-19'), name: "Presidents' Day", country: 'US' },
  { date: new Date('2024-05-27'), name: "Memorial Day", country: 'US' },
  { date: new Date('2024-06-19'), name: "Juneteenth", country: 'US' },
  { date: new Date('2024-07-04'), name: "Independence Day", country: 'US' },
  { date: new Date('2024-09-02'), name: "Labor Day", country: 'US' },
  { date: new Date('2024-10-14'), name: "Columbus Day", country: 'US' },
  { date: new Date('2024-11-11'), name: "Veterans Day", country: 'US' },
  { date: new Date('2024-11-28'), name: "Thanksgiving Day", country: 'US' },
  { date: new Date('2024-12-25'), name: "Christmas Day", country: 'US' }
];

/**
 * Service for managing holidays in the Healthcare Management Application
 * In a production environment, this would likely use a database-backed model
 */
const holidayService = {
  /**
   * Get all holidays
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} List of holidays
   */
  getHolidays: async (filters = {}) => {
    try {
      logger.info('Fetching holidays', { filters });
      
      let filteredHolidays = [...holidayCache];
      
      // Apply country filter
      if (filters.country) {
        filteredHolidays = filteredHolidays.filter(h => 
          h.country.toLowerCase() === filters.country.toLowerCase()
        );
      }
      
      // Apply year filter
      if (filters.year) {
        const year = parseInt(filters.year, 10);
        filteredHolidays = filteredHolidays.filter(h => h.date.getFullYear() === year);
      }
      
      logger.info('Successfully fetched holidays', { 
        count: filteredHolidays.length 
      });
      
      return filteredHolidays;
    } catch (error) {
      logger.error('Failed to fetch holidays', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Get holidays within a date range
   * @param {Date} startDate - Range start date
   * @param {Date} endDate - Range end date
   * @param {string} [country='US'] - Country code
   * @returns {Promise<Array>} List of holidays within range
   */
  getHolidaysInRange: async (startDate, endDate, country = 'US') => {
    try {
      logger.info('Fetching holidays in date range', { 
        startDate, 
        endDate, 
        country 
      });
      
      // Convert to Date objects if needed
      const start = startDate instanceof Date ? startDate : new Date(startDate);
      const end = endDate instanceof Date ? endDate : new Date(endDate);
      
      if (start > end) {
        throw new BadRequestError('Start date must be before end date');
      }
      
      // Filter holidays by date range and country
      const holidays = holidayCache.filter(holiday => 
        holiday.date >= start && 
        holiday.date <= end && 
        holiday.country.toLowerCase() === country.toLowerCase()
      );
      
      logger.info('Successfully fetched holidays in range', { 
        count: holidays.length 
      });
      
      return holidays;
    } catch (error) {
      logger.error('Failed to fetch holidays in range', { 
        error: error.message,
        startDate,
        endDate
      });
      throw error;
    }
  },
  
  /**
   * Check if a specific date is a holiday
   * @param {Date} date - Date to check
   * @param {string} [country='US'] - Country code
   * @returns {Promise<boolean>} Whether date is a holiday
   */
  isHoliday: async (date, country = 'US') => {
    try {
      // Convert to Date object if needed
      const checkDate = date instanceof Date ? date : new Date(date);
      
      // Reset time portion for date comparison
      checkDate.setHours(0, 0, 0, 0);
      
      // Check if date matches any holiday
      const isHoliday = holidayCache.some(holiday => {
        const holidayDate = new Date(holiday.date);
        holidayDate.setHours(0, 0, 0, 0);
        
        return (
          holidayDate.getTime() === checkDate.getTime() && 
          holiday.country.toLowerCase() === country.toLowerCase()
        );
      });
      
      return isHoliday;
    } catch (error) {
      logger.error('Failed to check if date is a holiday', { 
        error: error.message,
        date
      });
      throw error;
    }
  },
  
  /**
   * Add a custom holiday (for testing or local holidays)
   * @param {Object} holiday - Holiday data
   * @returns {Promise<Object>} Added holiday
   */
  addHoliday: async (holiday) => {
    try {
      logger.info('Adding custom holiday', { holiday });
      
      // Validate holiday data
      if (!holiday.date || !holiday.name || !holiday.country) {
        throw new BadRequestError('Holiday must have date, name, and country');
      }
      
      const newHoliday = {
        date: holiday.date instanceof Date ? holiday.date : new Date(holiday.date),
        name: holiday.name,
        country: holiday.country
      };
      
      // Add to cache
      holidayCache.push(newHoliday);
      
      logger.info('Successfully added custom holiday', { 
        name: newHoliday.name,
        date: newHoliday.date
      });
      
      return newHoliday;
    } catch (error) {
      logger.error('Failed to add custom holiday', { 
        error: error.message,
        holiday
      });
      throw error;
    }
  }
};

module.exports = holidayService;
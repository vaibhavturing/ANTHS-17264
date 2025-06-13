const moment = require('moment');

/**
 * Utility functions for date operations in the Healthcare Management Application
 */
const dateUtil = {
  /**
   * Parse a date string in various formats
   * @param {string} dateStr - Date string to parse
   * @returns {Date|null} Parsed date or null if invalid
   */
  parseDate: (dateStr) => {
    if (!dateStr) return null;
    
    // Try parsing with moment which can handle multiple formats
    const parsedDate = moment(dateStr);
    
    // Check if valid
    if (!parsedDate.isValid()) {
      return null;
    }
    
    return parsedDate.toDate();
  },
  
  /**
   * Format a date to the application's standard format (YYYY-MM-DD)
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDate: (date) => {
    if (!date) return '';
    return moment(date).format('YYYY-MM-DD');
  },
  
  /**
   * Format a time to the application's standard format (HH:mm)
   * @param {Date|string} date - Date/time to format
   * @returns {string} Formatted time string
   */
  formatTime: (date) => {
    if (!date) return '';
    return moment(date).format('HH:mm');
  },
  
  /**
   * Format a datetime to the application's standard format (YYYY-MM-DD HH:mm)
   * @param {Date|string} date - Datetime to format
   * @returns {string} Formatted datetime string
   */
  formatDateTime: (date) => {
    if (!date) return '';
    return moment(date).format('YYYY-MM-DD HH:mm');
  },
  
  /**
   * Get start of day for a given date
   * @param {Date|string} date - Date to use
   * @returns {Date} Date object set to start of day
   */
  getStartOfDay: (date) => {
    return moment(date).startOf('day').toDate();
  },
  
  /**
   * Get end of day for a given date
   * @param {Date|string} date - Date to use
   * @returns {Date} Date object set to end of day
   */
  getEndOfDay: (date) => {
    return moment(date).endOf('day').toDate();
  },
  
  /**
   * Check if a date is in the future
   * @param {Date|string} date - Date to check
   * @returns {boolean} True if date is in the future
   */
  isFutureDate: (date) => {
    return moment(date).isAfter(moment());
  },
  
  /**
   * Add duration to a date
   * @param {Date|string} date - Starting date
   * @param {number} amount - Amount to add
   * @param {string} unit - Unit (minutes, hours, days, weeks, months)
   * @returns {Date} New date with duration added
   */
  addDuration: (date, amount, unit = 'minutes') => {
    return moment(date).add(amount, unit).toDate();
  }
};

module.exports = dateUtil;
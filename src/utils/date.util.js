/**
 * Utilities for date operations
 */

/**
 * Format a date to a string
 * @param {Date} date - Date to format
 * @param {string} format - Format string (default: YYYY-MM-DD)
 * @returns {string} Formatted date string
 */
const formatDate = (date, format = 'YYYY-MM-DD') => {
  if (!date) return null;
  
  const d = new Date(date);
  
  if (isNaN(d.getTime())) return null;
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

/**
 * Calculate the difference in days between two dates
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} Difference in days
 */
const dateDiffInDays = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Convert to UTC to avoid timezone issues
  const utcDate1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utcDate2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  
  // Calculate difference in milliseconds
  const diff = Math.abs(utcDate2 - utcDate1);
  
  // Convert to days
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

/**
 * Calculate age from date of birth
 * @param {Date} dateOfBirth - Date of birth
 * @returns {number} Age in years
 */
const calculateAge = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  // Adjust age based on month and day
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
};

module.exports = {
  formatDate,
  dateDiffInDays,
  calculateAge
};
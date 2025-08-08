/**
 * Timezone Helper Utilities
 * 
 * Provides consistent timezone handling for local Pakistan timezone
 * across the entire application. Automatically detects the local timezone.
 */

/**
 * Get the local timezone of the system
 * @returns {string} - Local timezone (e.g., 'Asia/Karachi', 'Asia/Islamabad')
 */
function getLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get the current UTC offset in hours
 * @returns {number} - UTC offset in hours (e.g., 5 for Pakistan)
 */
function getUTCOffset() {
  return new Date().getTimezoneOffset() / -60;
}

/**
 * Convert UTC time to local Pakistan timezone
 * @param {Date|string} utcTime - UTC time
 * @returns {Date} - Time in local timezone
 */
function convertToLocalTime(utcTime) {
  if (!utcTime) return null;
  
  const date = new Date(utcTime);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }
  
  // Use the local timezone offset instead of hardcoded +5
  const localOffset = getUTCOffset();
  const localTime = new Date(date.getTime() + (localOffset * 60 * 60 * 1000));
  return localTime;
}

/**
 * Convert local time to UTC for database storage
 * @param {Date|string} localTime - Time in local timezone
 * @returns {Date} - UTC time
 */
function convertToUTC(localTime) {
  if (!localTime) return null;
  
  const date = new Date(localTime);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date provided');
  }
  
  // Convert local time back to UTC using local offset
  const localOffset = getUTCOffset();
  const utcTime = new Date(date.getTime() - (localOffset * 60 * 60 * 1000));
  return utcTime;
}

/**
 * Format time for local timezone display
 * @param {Date|string} time - Time to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted time string
 */
function formatLocalTime(time, options = {}) {
  if (!time) return 'N/A';
  
  const date = new Date(time);
  if (isNaN(date.getTime())) {
    return 'Invalid Time';
  }
  
  const defaultOptions = {
    timeZone: getLocalTimezone(),
    hour12: true,
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return date.toLocaleTimeString('en-US', defaultOptions);
}

/**
 * Format date for local timezone display
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date string
 */
function formatLocalDate(date, options = {}) {
  if (!date) return 'N/A';
  
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const defaultOptions = {
    timeZone: getLocalTimezone(),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  
  return dateObj.toLocaleDateString('en-US', defaultOptions);
}

/**
 * Format full date and time for local timezone
 * @param {Date|string} datetime - DateTime to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted datetime string
 */
function formatLocalDateTime(datetime, options = {}) {
  if (!datetime) return 'N/A';
  
  const date = new Date(datetime);
  if (isNaN(date.getTime())) {
    return 'Invalid DateTime';
  }
  
  const defaultOptions = {
    timeZone: getLocalTimezone(),
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options
  };
  
  return date.toLocaleString('en-US', defaultOptions);
}

/**
 * Get current local time
 * @returns {Date} - Current time in local timezone
 */
function getCurrentLocalTime() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: getLocalTimezone() }));
}

/**
 * Check if a time falls within local working hours (9 AM - 6 PM)
 * @param {Date|string} time - Time to check
 * @returns {boolean} - True if within working hours
 */
function isWithinWorkingHours(time) {
  if (!time) return false;
  
  const date = new Date(time);
  if (isNaN(date.getTime())) {
    return false;
  }
  
  // Get hour in local timezone
  const localHour = parseInt(date.toLocaleString('en-US', {
    timeZone: getLocalTimezone(),
    hour: 'numeric',
    hour12: false
  }));
  
  return localHour >= 9 && localHour <= 18;
}

/**
 * Convert ZKTeco device timestamp to proper local time
 * ZKTeco timestamps are already in local time (Pakistan timezone)
 * @param {string|Date} zktecoTimestamp - Timestamp from ZKTeco device
 * @returns {Date} - Properly formatted local time
 */
function processZKTecoTimestamp(zktecoTimestamp) {
  if (!zktecoTimestamp) return null;
  
  try {
    // ZKTeco timestamps are already in local time (Pakistan timezone)
    // For example: "Fri Aug 08 2025 05:50:49 GMT+0500" is already in Pakistan time
    const localDate = new Date(zktecoTimestamp);
    if (isNaN(localDate.getTime())) {
      throw new Error('Invalid ZKTeco timestamp');
    }
    
    // The ZKTeco device sends timestamps that are already in local time
    // No conversion needed - just return the date as is
    return localDate;
    
  } catch (error) {
    console.error('Error processing ZKTeco timestamp:', error);
    return null;
  }
}

/**
 * Create a date for today in local timezone
 * @returns {Date} - Today's date at midnight local time
 */
function getTodayLocalDate() {
  const now = new Date();
  const localDateString = now.toLocaleDateString('en-CA', { // YYYY-MM-DD format
    timeZone: getLocalTimezone()
  });
  return new Date(localDateString + 'T00:00:00.000Z');
}

module.exports = {
  // Legacy functions for backward compatibility
  convertToPakistanTime: convertToLocalTime,
  formatPakistanTime: formatLocalTime,
  formatPakistanDate: formatLocalDate,
  formatPakistanDateTime: formatLocalDateTime,
  getCurrentPakistanTime: getCurrentLocalTime,
  getTodayPakistanDate: getTodayLocalDate,
  
  // New local timezone functions
  getLocalTimezone,
  getUTCOffset,
  convertToLocalTime,
  convertToUTC,
  formatLocalTime,
  formatLocalDate,
  formatLocalDateTime,
  getCurrentLocalTime,
  isWithinWorkingHours,
  processZKTecoTimestamp,
  getTodayLocalDate
};
/**
 * Timezone Helper Utilities
 *
 * Provides consistent timezone handling for local Pakistan timezone
 * across the entire application. Automatically detects the local timezone.
 */

const DEFAULT_PAKISTAN_TIMEZONE = process.env.PAKISTAN_TIMEZONE || 'Asia/Karachi';

/**
 * Normalize a date to Pakistan timezone regardless of server locale
 * @param {Date|string|number} inputDate
 * @returns {Date}
 */
function normalizeToPakistanTime(inputDate = new Date()) {
  const sourceDate = inputDate instanceof Date ? inputDate : new Date(inputDate);
  return new Date(sourceDate.toLocaleString('en-US', { timeZone: DEFAULT_PAKISTAN_TIMEZONE }));
}

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
 * Get Pakistan date parts (YYYY, MM, DD) for the provided date
 * @param {Date|string|number} date
 * @returns {{year: number, month: string, day: string, date: Date}}
 */
function getPakistanDateParts(date = new Date()) {
  const pakistanDate = normalizeToPakistanTime(date);
  const year = pakistanDate.getFullYear();
  const month = String(pakistanDate.getMonth() + 1).padStart(2, '0');
  const day = String(pakistanDate.getDate()).padStart(2, '0');

  return { year, month, day, date: pakistanDate };
}

/**
 * Get Pakistan ISO date (YYYY-MM-DD)
 * @param {Date|string|number} date
 * @returns {string}
 */
function getPakistanISODate(date = new Date()) {
  const { year, month, day } = getPakistanDateParts(date);
  return `${year}-${month}-${day}`;
}

/**
 * Get Pakistan day range for a provided date
 * @param {Date|string|number} date
 * @returns {{date: Date, dateString: string, startDateTime: string, endDateTime: string}}
 */
function getPakistanDayRange(date = new Date()) {
  const { date: normalizedDate } = getPakistanDateParts(date);
  const dateString = getPakistanISODate(normalizedDate);

  return {
    date: normalizedDate,
    dateString,
    startDateTime: `${dateString}T00:00:00`,
    endDateTime: `${dateString}T23:59:59`
  };
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
    // Parse the ZKTeco timestamp
    const localDate = new Date(zktecoTimestamp);
    if (isNaN(localDate.getTime())) {
      throw new Error('Invalid ZKTeco timestamp');
    }
    
    // Check if the date is in the past or future (more than 1 day)
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const diffMs = Math.abs(now.getTime() - localDate.getTime());
    
    if (diffMs > oneDayMs) {
      // If the date is more than 1 day off, use current date with the time from device
      console.log('⚠️ ZKTeco timestamp date is off by more than 1 day, using current date');
      const currentDate = new Date();
      const deviceTime = localDate;
      
      // Create new date with current date but device time
      const correctedDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        deviceTime.getHours(),
        deviceTime.getMinutes(),
        deviceTime.getSeconds()
      );
      
      return correctedDate;
    }
    
    // If the date is reasonable, return as is
    return localDate;
    
  } catch (error) {
    console.error('Error processing ZKTeco timestamp:', error);
    // Fallback to current time if timestamp is invalid
    return new Date();
  }
}

/**
 * Create a date for today in local timezone
 * @returns {Date} - Today's date at midnight local time
 */
function getTodayLocalDate() {
  const now = new Date();
  // Use today's date directly without timezone conversion
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
  getTodayLocalDate,
  normalizeToPakistanTime,
  getPakistanDateParts,
  getPakistanISODate,
  getPakistanDayRange,
  DEFAULT_PAKISTAN_TIMEZONE
};
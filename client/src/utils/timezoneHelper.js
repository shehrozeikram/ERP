/**
 * Frontend Timezone Helper for Local Timezone
 * 
 * Provides consistent timezone handling for displaying times in local timezone
 * across the React frontend. Automatically detects the local timezone.
 */

/**
 * Get the local timezone of the system
 * @returns {string} - Local timezone (e.g., 'Asia/Karachi', 'Asia/Islamabad')
 */
export const getLocalTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get the current UTC offset in hours
 * @returns {number} - UTC offset in hours (e.g., 5 for Pakistan)
 */
export const getUTCOffset = () => {
  return new Date().getTimezoneOffset() / -60;
};

/**
 * Format time for local timezone display
 * @param {Date|string} time - Time to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted time string
 */
export const formatLocalTime = (time, options = {}) => {
  if (!time) return 'N/A';
  
  try {
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
  } catch (error) {
    console.error('Error formatting local time:', error);
    return 'Invalid Time';
  }
};

/**
 * Format date for local timezone display
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date string
 */
export const formatLocalDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  try {
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
  } catch (error) {
    console.error('Error formatting local date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format full date and time for local timezone
 * @param {Date|string} datetime - DateTime to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted datetime string
 */
export const formatLocalDateTime = (datetime, options = {}) => {
  if (!datetime) return 'N/A';
  
  try {
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
  } catch (error) {
    console.error('Error formatting local datetime:', error);
    return 'Invalid DateTime';
  }
};

/**
 * Get current local time
 * @returns {Date} - Current time in local timezone
 */
export const getCurrentLocalTime = () => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: getLocalTimezone() }));
};

/**
 * Check if a time falls within local working hours (9 AM - 6 PM)
 * @param {Date|string} time - Time to check
 * @returns {boolean} - True if within working hours
 */
export const isWithinWorkingHours = (time) => {
  if (!time) return false;
  
  try {
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
  } catch (error) {
    console.error('Error checking working hours:', error);
    return false;
  }
};

/**
 * Convert time to local timezone and return formatted string
 * Specifically handles attendance check-in/check-out times
 * @param {Date|string} time - Time to convert and format
 * @returns {string} - Time formatted as "HH:MM AM/PM" in local timezone
 */
export const formatAttendanceTime = (time) => {
  if (!time) return 'N/A';
  
  try {
    const date = new Date(time);
    if (isNaN(date.getTime())) {
      return 'Invalid Time';
    }
    
    // Format specifically for attendance display
    return date.toLocaleTimeString('en-US', {
      timeZone: getLocalTimezone(),
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting attendance time:', error);
    return 'Invalid Time';
  }
};

/**
 * Get a human-readable time difference
 * @param {Date|string} startTime - Start time
 * @param {Date|string} endTime - End time
 * @returns {string} - Human readable duration
 */
export const getTimeDifference = (startTime, endTime) => {
  if (!startTime || !endTime) return 'N/A';
  
  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Invalid';
    }
    
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 0) return 'Invalid';
    
    const hours = Math.floor(diffHours);
    const minutes = Math.floor((diffHours - hours) * 60);
    
    if (hours === 0) {
      return `${minutes} min`;
    }
    
    return `${hours}h ${minutes}m`;
  } catch (error) {
    console.error('Error calculating time difference:', error);
    return 'Invalid';
  }
};

/**
 * Check if a check-in time is considered late (after 9:30 AM local time)
 * @param {Date|string} checkInTime - Check-in time
 * @returns {boolean} - True if late
 */
export const isLateCheckIn = (checkInTime) => {
  if (!checkInTime) return false;
  
  try {
    const date = new Date(checkInTime);
    if (isNaN(date.getTime())) {
      return false;
    }
    
    // Get time components in local timezone
    const localTime = date.toLocaleString('en-US', {
      timeZone: getLocalTimezone(),
      hour12: false,
      hour: 'numeric',
      minute: 'numeric'
    });
    
    const [hour, minute] = localTime.split(':').map(Number);
    const totalMinutes = hour * 60 + minute;
    
    // 9:30 AM = 570 minutes
    return totalMinutes > 570;
  } catch (error) {
    console.error('Error checking late check-in:', error);
    return false;
  }
};

/**
 * Format date for input fields (YYYY-MM-DD format in local timezone)
 * @param {Date|string} date - Date to format
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const formatDateForInput = (date) => {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    // Get date in local timezone
    return dateObj.toLocaleDateString('en-CA', {
      timeZone: getLocalTimezone()
    });
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
};

// Legacy exports for backward compatibility
export const formatPakistanTime = formatLocalTime;
export const formatPakistanDate = formatLocalDate;
export const formatPakistanDateTime = formatLocalDateTime;
export const getCurrentPakistanTime = getCurrentLocalTime;
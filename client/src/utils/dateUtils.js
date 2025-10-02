/**
 * Date utility functions for consistent date formatting across the application
 */

/**
 * Format a date to a readable string
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };
    
    return dateObj.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format a date to YYYY-MM-DD format for input fields
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
    
    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error formatting date for input:', error);
    return '';
  }
};

/**
 * Format a date and time to a readable string
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted date and time string
 */
export const formatDateTime = (date, options = {}) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    };
    
    return dateObj.toLocaleString('en-US', defaultOptions);
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return 'Invalid Date';
  }
};

/**
 * Format time only
 * @param {Date|string} date - Date to format
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted time string
 */
export const formatTime = (date, options = {}) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Time';
    }
    
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      ...options
    };
    
    return dateObj.toLocaleTimeString('en-US', defaultOptions);
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid Time';
  }
};

/**
 * Get relative time (e.g., "2 days ago", "in 3 hours")
 * @param {Date|string} date - Date to compare
 * @returns {string} - Relative time string
 */
export const getRelativeTime = (date) => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    const now = new Date();
    const diffMs = now - dateObj;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return formatDate(dateObj);
    }
  } catch (error) {
    console.error('Error getting relative time:', error);
    return 'Invalid Date';
  }
};

/**
 * Check if a date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is today
 */
export const isToday = (date) => {
  if (!date) return false;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return false;
    }
    
    const today = new Date();
    return dateObj.toDateString() === today.toDateString();
  } catch (error) {
    console.error('Error checking if date is today:', error);
    return false;
  }
};

/**
 * Check if a date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is in the past
 */
export const isPast = (date) => {
  if (!date) return false;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return false;
    }
    
    return dateObj < new Date();
  } catch (error) {
    console.error('Error checking if date is past:', error);
    return false;
  }
};

/**
 * Check if a date is in the future
 * @param {Date|string} date - Date to check
 * @returns {boolean} - True if date is in the future
 */
export const isFuture = (date) => {
  if (!date) return false;
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return false;
    }
    
    return dateObj > new Date();
  } catch (error) {
    console.error('Error checking if date is future:', error);
    return false;
  }
};

/**
 * Add days to a date
 * @param {Date|string} date - Base date
 * @param {number} days - Number of days to add
 * @returns {Date} - New date with days added
 */
export const addDays = (date, days) => {
  if (!date) return new Date();
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return new Date();
    }
    
    dateObj.setDate(dateObj.getDate() + days);
    return dateObj;
  } catch (error) {
    console.error('Error adding days to date:', error);
    return new Date();
  }
};

/**
 * Get the start of the day for a given date
 * @param {Date|string} date - Date to get start of day for
 * @returns {Date} - Start of day date
 */
export const getStartOfDay = (date) => {
  if (!date) return new Date();
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return new Date();
    }
    
    dateObj.setHours(0, 0, 0, 0);
    return dateObj;
  } catch (error) {
    console.error('Error getting start of day:', error);
    return new Date();
  }
};

/**
 * Get the end of the day for a given date
 * @param {Date|string} date - Date to get end of day for
 * @returns {Date} - End of day date
 */
export const getEndOfDay = (date) => {
  if (!date) return new Date();
  
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return new Date();
    }
    
    dateObj.setHours(23, 59, 59, 999);
    return dateObj;
  } catch (error) {
    console.error('Error getting end of day:', error);
    return new Date();
  }
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'PKR')
 * @param {string} locale - Locale (default: 'en-PK')
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = 'PKR', locale = 'en-PK') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'PKR 0';
  }
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (error) {
    console.error('Error formatting currency:', error);
    return `PKR ${amount}`;
  }
};

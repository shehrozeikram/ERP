/**
 * Biometric Systems Configuration
 * Centralized configuration for ZKTeco device and ZKBio Time system
 */

// Get configuration from environment variables with fallbacks
const getAttendanceConfig = () => {
  return {
    // ZKTeco Device settings (legacy)
    zkteco: {
      device: {
        host: process.env.ZKTECO_HOST || '182.180.55.96',
        port: parseInt(process.env.ZKTECO_PORT) || 85,
        websocketUrl: process.env.ZKTECO_WEBSOCKET_URL || 'ws://182.180.55.96:85/base/dashboard/realtime_punch/',
        timeout: parseInt(process.env.ZKTECO_TIMEOUT) || 10000,
        inMsgDelay: parseInt(process.env.ZKTECO_MSG_DELAY) || 4000
      }
    },

    // ZKBio Time System settings (new)
    zkbioTime: {
      baseURL: process.env.ZKBIO_BASE_URL || 'http://182.180.55.96:85',
      credentials: {
        username: process.env.ZKBIO_USERNAME || 'superuser',
        password: process.env.ZKBIO_PASSWORD || 'SGCit123456'
      },
      endpoints: {
        login: '/login/',
        dashboard: '/dashboard/',
        employees: '/api/employees/',
        attendance: '/api/attendance/',
        realtime: '/base/dashboard/realtime_punch/'
      },
      timeout: parseInt(process.env.ZKBIO_TIMEOUT) || 10000
    }
  };
};

const BIOMETRIC_CONFIG = {
  ...getAttendanceConfig(),

  // Shared settings for both systems
  shared: {
    // Authentication cookies (dynamically managed - no hardcoded values)
    cookies: {
      // Cookies are now dynamically obtained during authentication
      // No hardcoded values to prevent session conflicts
    },

    // User agent for requests
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

    // Connection settings
    connection: {
      maxReconnectAttempts: 5,
      reconnectInterval: 5000, // 5 seconds
      heartbeatInterval: 30000, // 30 seconds
    },

    // Logging settings
    logging: {
      enabled: true,
      level: 'info', // 'debug', 'info', 'warn', 'error'
      logWebSocketEvents: true,
      logPunchEvents: true
    }
  }
};

/**
 * Get formatted cookie string for HTTP requests
 * @returns {string} Formatted cookie string
 */
const getFormattedCookies = () => {
  const { cookies } = BIOMETRIC_CONFIG.shared;
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
};

/**
 * Update cookies (useful for when they expire)
 * @param {Object} newCookies - New cookie values
 */
const updateCookies = (newCookies) => {
  Object.assign(BIOMETRIC_CONFIG.shared.cookies, newCookies);
  console.log('🔄 Biometric system cookies updated:', Object.keys(newCookies));
};

/**
 * Get ZKTeco device configuration (legacy support)
 * @returns {Object} ZKTeco device connection settings
 */
const getDeviceConfig = () => {
  return BIOMETRIC_CONFIG.zkteco.device;
};

/**
 * Get ZKBio Time configuration
 * @returns {Object} ZKBio Time system settings
 */
const getZKBioTimeConfig = () => {
  return BIOMETRIC_CONFIG.zkbioTime;
};

/**
 * Get shared connection settings
 * @returns {Object} Connection settings
 */
const getConnectionConfig = () => {
  return BIOMETRIC_CONFIG.shared.connection;
};

/**
 * Get shared logging configuration
 * @returns {Object} Logging settings
 */
const getLoggingConfig = () => {
  return BIOMETRIC_CONFIG.shared.logging;
};

/**
 * Get user agent string
 * @returns {string} User agent
 */
const getUserAgent = () => {
  return BIOMETRIC_CONFIG.shared.userAgent;
};

module.exports = {
  BIOMETRIC_CONFIG,
  ZKTECO_CONFIG: BIOMETRIC_CONFIG, // Legacy support
  getFormattedCookies,
  updateCookies,
  getDeviceConfig,
  getZKBioTimeConfig,
  getConnectionConfig,
  getLoggingConfig,
  getUserAgent
};

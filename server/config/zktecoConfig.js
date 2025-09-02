/**
 * Biometric Systems Configuration
 * Centralized configuration for ZKTeco device and ZKBio Time system
 */

const BIOMETRIC_CONFIG = {
  // ZKTeco Device settings (legacy)
  zkteco: {
    device: {
      host: '182.180.55.96',
      port: 85,
      websocketUrl: 'ws://182.180.55.96:85/base/dashboard/realtime_punch/',
      timeout: 10000,
      inMsgDelay: 4000
    }
  },

  // ZKBio Time System settings (new)
  zkbioTime: {
    baseURL: 'http://182.180.55.96:85',
    credentials: {
      username: 'superuser',
      password: 'SGCit123456'
    },
    endpoints: {
      login: '/login/',
      dashboard: '/dashboard/',
      employees: '/api/employees/',
      attendance: '/api/attendance/',
      realtime: '/base/dashboard/realtime_punch/'
    },
    timeout: 10000
  },

  // Shared settings for both systems
  shared: {
    // Authentication cookies (update these when they expire)
    cookies: {
      account_info: 'eyJ1c2VybmFtZSI6ICIiLCAicGFzc3dvcmQiOiAiIiwgImVtcE5hbWUiOiAiIiwgImVtcFB3ZCI6ICIiLCAicmVtZW1iZXJfbWVfYWRtaW4iOiAiIiwgInJlbWVtYmVyX21lX2VtcGxveWVlIjogIiJ9',
      csrftoken: '5HYMUICZU4NuFZVlCuCwIoOLYnrKDTSp',
      django_language: 'en',
      sessionid: '9iseou0t87g07grp2ivcpsnfzkgkw0mw'
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

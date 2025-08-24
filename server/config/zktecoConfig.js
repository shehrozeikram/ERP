/**
 * ZKTeco Device Configuration
 * Centralized configuration for ZKTeco device connections and authentication
 */

const ZKTECO_CONFIG = {
  // Device connection settings
  device: {
    host: '182.180.55.96',
    port: 85,
    websocketUrl: 'ws://182.180.55.96:85/base/dashboard/realtime_punch/',
    timeout: 10000,
    inMsgDelay: 4000
  },

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
};

/**
 * Get formatted cookie string for HTTP requests
 * @returns {string} Formatted cookie string
 */
const getFormattedCookies = () => {
  const { cookies } = ZKTECO_CONFIG;
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
};

/**
 * Update cookies (useful for when they expire)
 * @param {Object} newCookies - New cookie values
 */
const updateCookies = (newCookies) => {
  Object.assign(ZKTECO_CONFIG.cookies, newCookies);
  console.log('🔄 ZKTeco cookies updated:', Object.keys(newCookies));
};

/**
 * Get device connection configuration
 * @returns {Object} Device connection settings
 */
const getDeviceConfig = () => {
  return ZKTECO_CONFIG.device;
};

/**
 * Get connection settings
 * @returns {Object} Connection settings
 */
const getConnectionConfig = () => {
  return ZKTECO_CONFIG.connection;
};

/**
 * Get logging configuration
 * @returns {Object} Logging settings
 */
const getLoggingConfig = () => {
  return ZKTECO_CONFIG.logging;
};

module.exports = {
  ZKTECO_CONFIG,
  getFormattedCookies,
  updateCookies,
  getDeviceConfig,
  getConnectionConfig,
  getLoggingConfig
};

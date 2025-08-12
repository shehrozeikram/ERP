const axios = require('axios');
const { getFormattedCookies, updateCookies } = require('../config/zktecoConfig');

/**
 * ZKTeco Keep-Alive Service
 * Maintains active session by periodically accessing the device
 */
class ZKTecoKeepAliveService {
  constructor() {
    this.isActive = false;
    this.keepAliveInterval = null;
    this.keepAliveIntervalMs = 5 * 60 * 1000; // 5 minutes
    this.lastKeepAlive = null;
    this.keepAliveCount = 0;
    this.baseURL = 'http://182.180.55.96:85';
    this.axiosInstance = null;
    this.sessionValid = false;
  }

  /**
   * Initialize the keep-alive service
   */
  async initialize() {
    try {
      console.log('🔄 Initializing ZKTeco Keep-Alive Service...');
      
      // Create axios instance with current cookies
      this.axiosInstance = axios.create({
        baseURL: this.baseURL,
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      // Set up request interceptor to always use latest cookies
      this.axiosInstance.interceptors.request.use((config) => {
        const cookies = getFormattedCookies();
        if (cookies) {
          config.headers.Cookie = cookies;
        }
        return config;
      });

      // Test initial connection
      const testResult = await this.testConnection();
      if (testResult.success) {
        console.log('✅ Keep-Alive service initialized successfully');
        this.sessionValid = true;
        return true;
      } else {
        console.log('⚠️ Keep-Alive service initialized but session may be invalid');
        this.sessionValid = false;
        return false;
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize Keep-Alive service:', error.message);
      return false;
    }
  }

  /**
   * Start the keep-alive mechanism
   */
  async start() {
    if (this.isActive) {
      console.log('⚠️ Keep-Alive service already active');
      return;
    }

    try {
      console.log('🔄 Starting ZKTeco Keep-Alive service...');
      
      // Initial keep-alive
      await this.performKeepAlive();
      
      // Set up periodic keep-alive
      this.keepAliveInterval = setInterval(async () => {
        await this.performKeepAlive();
      }, this.keepAliveIntervalMs);
      
      this.isActive = true;
      console.log(`✅ Keep-Alive service started (interval: ${this.keepAliveIntervalMs / 1000}s)`);
      
    } catch (error) {
      console.error('❌ Failed to start Keep-Alive service:', error.message);
    }
  }

  /**
   * Stop the keep-alive mechanism
   */
  stop() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    this.isActive = false;
    console.log('🛑 Keep-Alive service stopped');
  }

  /**
   * Perform a keep-alive request
   */
  async performKeepAlive() {
    try {
      console.log('💓 Performing ZKTeco keep-alive...');
      
      // Try multiple endpoints to maintain session
      const endpoints = [
        '/base/dashboard/',
        '/base/dashboard/realtime_punch/',
        '/base/dashboard/attendance/',
        '/api/login/'
      ];

      let success = false;
      
      for (const endpoint of endpoints) {
        try {
          const response = await this.axiosInstance.get(endpoint);
          
          if (response.status === 200) {
            console.log(`✅ Keep-alive successful on ${endpoint}`);
            
            // Check if we got new cookies from the response
            if (response.headers['set-cookie']) {
              console.log('🔄 Updating cookies from keep-alive response...');
              const newCookies = this.parseSetCookieHeaders(response.headers['set-cookie']);
              if (newCookies.length > 0) {
                updateCookies(newCookies);
                console.log('✅ Cookies updated from keep-alive response');
              }
            }
            
            success = true;
            break;
          }
        } catch (endpointError) {
          console.log(`⚠️ Keep-alive failed on ${endpoint}:`, endpointError.response?.status || endpointError.message);
          continue;
        }
      }

      if (success) {
        this.keepAliveCount++;
        this.lastKeepAlive = new Date();
        this.sessionValid = true;
        console.log(`💓 Keep-alive successful (count: ${this.keepAliveCount})`);
      } else {
        console.log('❌ All keep-alive endpoints failed');
        this.sessionValid = false;
      }

      return success;
      
    } catch (error) {
      console.error('❌ Keep-alive error:', error.message);
      this.sessionValid = false;
      return false;
    }
  }

  /**
   * Test the current connection
   */
  async testConnection() {
    try {
      const response = await this.axiosInstance.get('/base/dashboard/');
      return { success: response.status === 200, status: response.status };
    } catch (error) {
      return { success: false, status: error.response?.status, error: error.message };
    }
  }

  /**
   * Parse Set-Cookie headers and extract cookie data
   */
  parseSetCookieHeaders(setCookieHeaders) {
    if (!Array.isArray(setCookieHeaders)) {
      setCookieHeaders = [setCookieHeaders];
    }

    const cookies = [];
    
    for (const header of setCookieHeaders) {
      try {
        const cookieParts = header.split(';')[0].split('=');
        if (cookieParts.length === 2) {
          cookies.push({
            name: cookieParts[0].trim(),
            value: cookieParts[1].trim()
          });
        }
      } catch (parseError) {
        console.log('⚠️ Failed to parse cookie header:', header);
      }
    }
    
    return cookies;
  }

  /**
   * Force a keep-alive refresh
   */
  async forceRefresh() {
    console.log('🔄 Force refreshing ZKTeco session...');
    return await this.performKeepAlive();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      sessionValid: this.sessionValid,
      lastKeepAlive: this.lastKeepAlive,
      keepAliveCount: this.keepAliveCount,
      intervalMs: this.keepAliveIntervalMs,
      nextKeepAlive: this.lastKeepAlive ? 
        new Date(this.lastKeepAlive.getTime() + this.keepAliveIntervalMs) : null
    };
  }

  /**
   * Update keep-alive interval
   */
  setInterval(intervalMs) {
    if (this.isActive) {
      this.stop();
      this.keepAliveIntervalMs = intervalMs;
      this.start();
    } else {
      this.keepAliveIntervalMs = intervalMs;
    }
    console.log(`🔄 Keep-alive interval updated to ${intervalMs / 1000}s`);
  }
}

module.exports = ZKTecoKeepAliveService;

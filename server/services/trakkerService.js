const axios = require('axios');

class TrakkerService {
  constructor() {
    this.baseURL = 'https://mytrakker.tpltrakker.com/TrakkerServices/Api';
    this.tokenCache = {
      token: null,
      expiresAt: null
    };
    
    // Get credentials from environment variables
    this.userId = process.env.TRAKKER_USER_ID || 'R6OWBDP';
    this.password = process.env.TRAKKER_PASSWORD || '86a3afb7-4b00-44f8-a06f-10afca47f7ee';
  }

  /**
   * Get authentication token from Trakker API
   * Caches the token until it expires
   */
  async getToken() {
    try {
      // Check if we have a valid cached token
      if (this.tokenCache.token && this.tokenCache.expiresAt && Date.now() < this.tokenCache.expiresAt) {
        return this.tokenCache.token;
      }

      // Fetch new token
      const response = await axios.post(
        `${this.baseURL}/Services/GetToken`,
        {
          UserID: this.userId,
          Password: this.password
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      const token = response.data?.token || response.data;
      
      if (!token) {
        throw new Error('No token received from Trakker API');
      }

      // Cache the token (expires in 60 seconds based on the JWT example)
      // Set expiration to 50 seconds to be safe
      this.tokenCache.token = token;
      this.tokenCache.expiresAt = Date.now() + (50 * 1000);

      return token;
    } catch (error) {
      console.error('Error fetching Trakker token:', error.message);
      throw new Error(`Failed to authenticate with Trakker: ${error.message}`);
    }
  }

  /**
   * Get vehicle last location
   * @param {string} phone - Trakker phone number (e.g., "03129110707")
   * @param {string} deviceId - Trakker device ID (e.g., "1707")
   * @returns {Promise<Object>} Vehicle location data
   */
  async getVehicleLastLocation(phone, deviceId) {
    try {
      const token = await this.getToken();

      const response = await axios.get(
        `${this.baseURL}/Home/GetVLL/${phone}/${deviceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000 // 15 second timeout
        }
      );

      // Log the response structure for debugging (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Trakker API Response Structure:', JSON.stringify(response.data, null, 2));
      }

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching vehicle location:', error.message);
      
      if (error.response) {
        // API returned an error response
        return {
          success: false,
          error: error.response.data?.message || error.response.statusText || 'Failed to fetch vehicle location',
          statusCode: error.response.status
        };
      } else if (error.request) {
        // Request was made but no response received
        return {
          success: false,
          error: 'No response from Trakker API. Please check your connection.'
        };
      } else {
        // Error in request setup
        return {
          success: false,
          error: error.message || 'Failed to fetch vehicle location'
        };
      }
    }
  }

  /**
   * Clear cached token (useful for testing or forced refresh)
   */
  clearTokenCache() {
    this.tokenCache.token = null;
    this.tokenCache.expiresAt = null;
  }
}

module.exports = new TrakkerService();


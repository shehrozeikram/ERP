import api from './api';

const trakkerService = {
  /**
   * Get vehicle location by vehicle ID
   * @param {string} vehicleId - Vehicle ID (e.g., "VH001")
   * @returns {Promise<Object>} Vehicle location data
   */
  getVehicleLocation: async (vehicleId) => {
    const response = await api.get(`/trakker/vehicle/${vehicleId}/location`);
    return response.data;
  },

  /**
   * Get location by directly providing phone and deviceId
   * @param {string} phone - Trakker phone number
   * @param {string} deviceId - Trakker device ID
   * @returns {Promise<Object>} Location data
   */
  getLocation: async (phone, deviceId) => {
    const response = await api.get('/trakker/location', {
      params: { phone, deviceId }
    });
    return response.data;
  },

  /**
   * Test Trakker authentication token
   * @returns {Promise<Object>} Token test result
   */
  testToken: async () => {
    const response = await api.post('/trakker/test-token');
    return response.data;
  }
};

export default trakkerService;


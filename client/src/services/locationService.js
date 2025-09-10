import api from './api';

const locationService = {
  // Get all locations with optional filters
  getLocations: async (params = {}) => {
    const response = await api.get('/locations', { params });
    return response.data;
  },

  // Get single location
  getLocation: async (id) => {
    const response = await api.get(`/locations/${id}`);
    return response.data;
  },

  // Create new location
  createLocation: async (locationData) => {
    const response = await api.post('/locations', locationData);
    return response.data;
  },

  // Update location
  updateLocation: async (id, locationData) => {
    const response = await api.put(`/locations/${id}`, locationData);
    return response.data;
  },

  // Delete location
  deleteLocation: async (id) => {
    const response = await api.delete(`/locations/${id}`);
    return response.data;
  },

  // Update location status
  updateLocationStatus: async (id, status) => {
    const response = await api.put(`/locations/${id}/status`, { status });
    return response.data;
  }
};

export default locationService;

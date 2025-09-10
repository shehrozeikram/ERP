import api from './api';

const vehicleService = {
  // Get all vehicles with optional filters
  getVehicles: async (params = {}) => {
    const response = await api.get('/vehicles', { params });
    return response.data;
  },

  // Get available vehicles only
  getAvailableVehicles: async () => {
    const response = await api.get('/vehicles/available');
    return response.data;
  },

  // Get single vehicle
  getVehicle: async (id) => {
    const response = await api.get(`/vehicles/${id}`);
    return response.data;
  },

  // Create new vehicle
  createVehicle: async (vehicleData) => {
    const response = await api.post('/vehicles', vehicleData);
    return response.data;
  },

  // Update vehicle
  updateVehicle: async (id, vehicleData) => {
    const response = await api.put(`/vehicles/${id}`, vehicleData);
    return response.data;
  },

  // Assign driver to vehicle
  assignDriver: async (id, driverId) => {
    const response = await api.put(`/vehicles/${id}/assign`, { driverId });
    return response.data;
  },

  // Delete vehicle
  deleteVehicle: async (id) => {
    const response = await api.delete(`/vehicles/${id}`);
    return response.data;
  }
};

export default vehicleService;

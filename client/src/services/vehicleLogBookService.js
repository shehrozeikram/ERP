import api from './api';

const vehicleLogBookService = {
  // Get all log book entries with optional filters
  getLogBookEntries: async (params = {}) => {
    const response = await api.get('/vehicle-logbook', { params });
    return response.data;
  },

  // Get single log book entry
  getLogBookEntry: async (id) => {
    const response = await api.get(`/vehicle-logbook/${id}`);
    return response.data;
  },

  // Get log book entries for specific vehicle
  getVehicleLogBook: async (vehicleId, params = {}) => {
    const response = await api.get(`/vehicle-logbook/vehicle/${vehicleId}`, { params });
    return response.data;
  },

  // Get log book entries for specific driver
  getDriverLogBook: async (driverId, params = {}) => {
    const response = await api.get(`/vehicle-logbook/driver/${driverId}`, { params });
    return response.data;
  },

  // Create new log book entry
  createLogBookEntry: async (logBookData) => {
    const response = await api.post('/vehicle-logbook', logBookData);
    return response.data;
  },

  // Update log book entry
  updateLogBookEntry: async (id, logBookData) => {
    const response = await api.put(`/vehicle-logbook/${id}`, logBookData);
    return response.data;
  },

  // Update log book entry status
  updateLogBookStatus: async (id, status) => {
    const response = await api.put(`/vehicle-logbook/${id}/status`, { status });
    return response.data;
  },

  // Delete log book entry
  deleteLogBookEntry: async (id) => {
    const response = await api.delete(`/vehicle-logbook/${id}`);
    return response.data;
  },

  // Get log book summary
  getLogBookSummary: async () => {
    const response = await api.get('/vehicle-logbook/summary/overview');
    return response.data;
  }
};

export default vehicleLogBookService;


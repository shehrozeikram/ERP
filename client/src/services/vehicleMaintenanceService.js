import api from './api';

const vehicleMaintenanceService = {
  // Get all maintenance records with optional filters
  getMaintenanceRecords: async (params = {}) => {
    const response = await api.get('/vehicle-maintenance', { params });
    return response.data;
  },

  // Get single maintenance record
  getMaintenanceRecord: async (id) => {
    const response = await api.get(`/vehicle-maintenance/${id}`);
    return response.data;
  },

  // Get maintenance records for specific vehicle
  getVehicleMaintenance: async (vehicleId, params = {}) => {
    const response = await api.get(`/vehicle-maintenance/vehicle/${vehicleId}`, { params });
    return response.data;
  },

  // Create new maintenance record
  createMaintenanceRecord: async (maintenanceData) => {
    const response = await api.post('/vehicle-maintenance', maintenanceData);
    return response.data;
  },

  // Update maintenance record
  updateMaintenanceRecord: async (id, maintenanceData) => {
    const response = await api.put(`/vehicle-maintenance/${id}`, maintenanceData);
    return response.data;
  },

  // Update maintenance status
  updateMaintenanceStatus: async (id, status) => {
    const response = await api.put(`/vehicle-maintenance/${id}/status`, { status });
    return response.data;
  },

  // Delete maintenance record
  deleteMaintenanceRecord: async (id) => {
    const response = await api.delete(`/vehicle-maintenance/${id}`);
    return response.data;
  },

  // Get maintenance summary
  getMaintenanceSummary: async () => {
    const response = await api.get('/vehicle-maintenance/summary/overview');
    return response.data;
  }
};

export default vehicleMaintenanceService;


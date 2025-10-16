import api from './api';

const leaveService = {
  // Get employee leave summary
  getEmployeeLeaveSummary: async (employeeId, year = new Date().getFullYear()) => {
    try {
      const response = await api.get(`/leaves/employee/${employeeId}/summary`, {
        params: { year }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get employee leave balance
  getEmployeeLeaveBalance: async (employeeId, year = new Date().getFullYear()) => {
    try {
      const response = await api.get(`/leaves/employee/${employeeId}/balance`, {
        params: { year }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Update employee leave configuration
  updateEmployeeLeaveConfig: async (employeeId, config) => {
    try {
      const response = await api.put(`/leaves/employee/${employeeId}/config`, config);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Initialize employee leave balance
  initializeEmployeeLeaveBalance: async (employeeId) => {
    try {
      const response = await api.post(`/leaves/employee/${employeeId}/initialize`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Sync employee leave balance
  syncEmployeeLeaveBalance: async (employeeId, year = new Date().getFullYear()) => {
    try {
      const response = await api.post(`/leaves/employee/${employeeId}/sync`, { year });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get advance leave deduction
  getAdvanceLeaveDeduction: async (employeeId, year, month, dailyRate) => {
    try {
      const response = await api.get(`/leaves/employee/${employeeId}/advance-deduction`, {
        params: { year, month, dailyRate }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get monthly leave stats
  getMonthlyLeaveStats: async (employeeId, year, month) => {
    try {
      const response = await api.get(`/leaves/employee/${employeeId}/monthly-stats`, {
        params: { year, month }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get global leave configuration
  getGlobalConfig: async () => {
    try {
      const response = await api.get('/leaves/global-config');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get all leave requests
  getLeaveRequests: async (filters = {}) => {
    try {
      const response = await api.get('/leaves/requests', { params: filters });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get leave request by ID
  getLeaveRequestById: async (id) => {
    try {
      const response = await api.get(`/leaves/requests/${id}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Create leave request
  createLeaveRequest: async (data) => {
    try {
      const response = await api.post('/leaves/requests', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Approve leave request
  approveLeaveRequest: async (id, comments = '') => {
    try {
      const response = await api.put(`/leaves/requests/${id}/approve`, { comments });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Reject leave request
  rejectLeaveRequest: async (id, reason) => {
    try {
      const response = await api.put(`/leaves/requests/${id}/reject`, { reason });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get leave types
  getLeaveTypes: async () => {
    try {
      const response = await api.get('/leaves/types');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get leave calendar
  getLeaveCalendar: async (year, month) => {
    try {
      const response = await api.get('/leaves/calendar', {
        params: { year, month }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Get leave statistics
  getLeaveStatistics: async (year = new Date().getFullYear()) => {
    try {
      const response = await api.get('/leaves/statistics', {
        params: { year }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export default leaveService;


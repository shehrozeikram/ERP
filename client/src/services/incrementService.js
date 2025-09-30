import api from './api';

const incrementService = {
  // Create increment request
  createIncrement: async (incrementData) => {
    try {
      const response = await api.post('/hr/increments', incrementData);
      return response.data;
    } catch (error) {
      console.error('Error creating increment:', error);
      throw error;
    }
  },

  // Get all increment requests
  getAllIncrements: async () => {
    try {
      console.log('🔍 Fetching all increments...');
      const response = await api.get('/hr/increments');
      console.log('✅ All increments fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching all increments:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  },

  // Get pending increment requests
  getPendingIncrements: async () => {
    try {
      console.log('🔍 Fetching pending increments...');
      const response = await api.get('/hr/increments/pending');
      console.log('✅ Pending increments fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching pending increments:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw error;
    }
  },

  // Approve increment request
  approveIncrement: async (incrementId, comments = '') => {
    try {
      const response = await api.put(`/hr/increments/${incrementId}/approve`, { comments });
      return response.data;
    } catch (error) {
      console.error('Error approving increment:', error);
      throw error;
    }
  },

  // Reject increment request
  rejectIncrement: async (incrementId, comments = '') => {
    try {
      const response = await api.put(`/hr/increments/${incrementId}/reject`, { comments });
      return response.data;
    } catch (error) {
      console.error('Error rejecting increment:', error);
      throw error;
    }
  },

  // Get employee increment history
  getEmployeeIncrementHistory: async (employeeId) => {
    try {
      const response = await api.get(`/hr/increments/employee/${employeeId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching increment history:', error);
      throw error;
    }
  },

  // Get employee current salary
  getEmployeeCurrentSalary: async (employeeId) => {
    try {
      const response = await api.get(`/hr/increments/employee/${employeeId}/current-salary`);
      return response.data;
    } catch (error) {
      console.error('Error fetching current salary:', error);
      throw error;
    }
  },

  // Get increment by ID
  getIncrementById: async (incrementId) => {
    try {
      const response = await api.get(`/hr/increments/${incrementId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching increment by ID:', error);
      throw error;
    }
  }
};

export default incrementService;

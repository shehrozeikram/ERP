import api from './api';

const staffAssignmentService = {
  // Get all staff assignments with optional filters
  getStaffAssignments: async (params = {}) => {
    const response = await api.get('/staff-assignments', { params });
    return response.data;
  },

  // Get single staff assignment
  getStaffAssignment: async (id) => {
    const response = await api.get(`/staff-assignments/${id}`);
    return response.data;
  },

  // Create new staff assignment
  createStaffAssignment: async (assignmentData) => {
    const response = await api.post('/staff-assignments', assignmentData);
    return response.data;
  },

  // Update staff assignment
  updateStaffAssignment: async (id, assignmentData) => {
    const response = await api.put(`/staff-assignments/${id}`, assignmentData);
    return response.data;
  },

  // Delete staff assignment
  deleteStaffAssignment: async (id) => {
    const response = await api.delete(`/staff-assignments/${id}`);
    return response.data;
  },

  // Transfer staff assignment
  transferStaffAssignment: async (id, transferData) => {
    const response = await api.put(`/staff-assignments/${id}/transfer`, transferData);
    return response.data;
  },

  // Update assignment status
  updateAssignmentStatus: async (id, status) => {
    const response = await api.put(`/staff-assignments/${id}/status`, { status });
    return response.data;
  },

  // Get staff assignments by type (guards, office staff, etc.)
  getByType: async (assignmentType, params = {}) => {
    const response = await api.get(`/staff-assignments/by-type/${assignmentType}`, { params });
    return response.data;
  },

  // Get staff assignments summary by type
  getSummary: async () => {
    const response = await api.get('/staff-assignments/summary');
    return response.data;
  },

  // Get employees for staff assignment
  getEmployees: async () => {
    const response = await api.get('/hr/employees?getAll=true&isActive=true');
    return response.data;
  }
};

export default staffAssignmentService;

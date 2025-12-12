import api from './api';

const level0ApproversService = {
  // Get all Level 0 approver assignments
  getAll: () => {
    return api.get('/level0-approvers');
  },

  // Get a specific assignment
  getById: (id) => {
    return api.get(`/level0-approvers/${id}`);
  },

  // Create a new assignment
  create: (data) => {
    return api.post('/level0-approvers', data);
  },

  // Update an assignment
  update: (id, data) => {
    return api.put(`/level0-approvers/${id}`, data);
  },

  // Delete (deactivate) an assignment
  delete: (id) => {
    return api.delete(`/level0-approvers/${id}`);
  },

  // Get approvers for a project
  getByProject: (projectId) => {
    return api.get(`/level0-approvers/project/${projectId}`);
  },

  // Get approvers for a department-project combination
  getByDepartmentProject: (departmentId, projectId) => {
    return api.get(`/level0-approvers/department-project/${departmentId}/${projectId}`);
  },

  // Get assignments for a user
  getByUser: (userId) => {
    return api.get(`/level0-approvers/user/${userId}`);
  }
};

export default level0ApproversService;


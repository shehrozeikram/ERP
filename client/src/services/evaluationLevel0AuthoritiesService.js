import api from './api';

export const evaluationLevel0AuthoritiesService = {
  // Get all Level 0 authorities
  getAll: () => {
    return api.get('/evaluation-level0-authorities');
  },

  // Get Level 0 authority by ID
  getById: (id) => {
    return api.get(`/evaluation-level0-authorities/${id}`);
  },

  // Create new Level 0 authority
  create: (data) => {
    return api.post('/evaluation-level0-authorities', data);
  },

  // Update Level 0 authority
  update: (id, data) => {
    return api.put(`/evaluation-level0-authorities/${id}`, data);
  },

  // Delete Level 0 authority
  delete: (id) => {
    return api.delete(`/evaluation-level0-authorities/${id}`);
  },

  // Get user's Level 0 authorities
  getByUserId: (userId) => {
    return api.get(`/evaluation-level0-authorities/user/${userId}`);
  }
};


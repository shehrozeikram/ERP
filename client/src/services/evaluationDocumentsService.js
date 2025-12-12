import api from './api';

export const evaluationDocumentsService = {
  // Get all evaluation documents
  getAll: (params = {}) => {
    return api.get('/evaluation-documents', { params });
  },

  // Get evaluation document by ID
  getById: (id, token = null) => {
    const params = token ? { token } : {};
    const endpoint = token ? `/public/evaluation-documents/${id}` : `/evaluation-documents/${id}`;
    return api.get(endpoint, { params });
  },

  // Create new evaluation document
  create: (data) => {
    return api.post('/evaluation-documents', data);
  },

  // Update evaluation document
  update: (id, data, token = null) => {
    const params = token ? { token } : {};
    const endpoint = token ? `/public/evaluation-documents/${id}` : `/evaluation-documents/${id}`;
    return api.put(endpoint, data, { params });
  },

  // Delete evaluation document
  delete: (id) => {
    return api.delete(`/evaluation-documents/${id}`);
  },

  // Get documents grouped by department or project for dashboard
  getGroupedByDepartment: (params = {}) => {
    return api.get('/evaluation-documents/dashboard/grouped', { params });
  },

  // Update status
  updateStatus: (id, status) => {
    return api.patch(`/evaluation-documents/${id}/status`, { status });
  },

  // Send evaluation documents to authorities
  sendDocuments: (data) => {
    return api.post('/evaluation-documents/send', data);
  },

  // Approve evaluation document
  approve: (id, data = {}) => {
    return api.post(`/evaluation-documents/${id}/approve`, data);
  },

  // Reject evaluation document
  reject: (id, data = {}) => {
    return api.post(`/evaluation-documents/${id}/reject`, data);
  },

  // Bulk approve evaluation documents
  bulkApprove: (data) => {
    return api.post('/evaluation-documents/bulk-approve', data);
  },

  // Get user's assigned approval levels
  getAssignedApprovalLevels: () => {
    return api.get('/evaluation-documents/approval-levels/assigned');
  }
};


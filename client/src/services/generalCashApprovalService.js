import api from './api';

const generalCashApprovalService = {
  getDepartments: async () => {
    const response = await api.get('/cash-approvals/general/departments');
    return response.data;
  },

  getApproverCandidates: async (params = {}) => {
    const response = await api.get('/cash-approvals/general/approver-candidates', { params });
    return response.data;
  },

  getAdvanceEmployees: async (params = {}) => {
    const response = await api.get('/cash-approvals/general/advance-employees', { params });
    return response.data;
  },

  list: async (params = {}) => {
    const response = await api.get('/cash-approvals', {
      params: { originatingModule: 'general', ...params }
    });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/cash-approvals/${id}`);
    return response.data;
  },

  create: async (formData) => {
    const response = await api.post('/cash-approvals', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  update: async (id, formData) => {
    const response = await api.put(`/cash-approvals/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  submit: async (id, body = {}) => {
    const response = await api.put(`/cash-approvals/${id}/submit`, body);
    return response.data;
  },

  approve: async (id, comments) => {
    const response = await api.put(`/cash-approvals/${id}/approve`, { comments });
    return response.data;
  },

  reject: async (id, rejectionReason) => {
    const response = await api.put(`/cash-approvals/${id}/reject`, { rejectionReason });
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/cash-approvals/${id}`);
    return response.data;
  }
};

export default generalCashApprovalService;

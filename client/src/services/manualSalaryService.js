import api from './api';

const manualSalaryService = {
  getAll: () => api.get('/hr/manual-salary'),
  getById: (id) => api.get(`/hr/manual-salary/${id}`),
  create: (data) => api.post('/hr/manual-salary', data),
  update: (id, data) => api.put(`/hr/manual-salary/${id}`, data),
  remove: (id) => api.delete(`/hr/manual-salary/${id}`),
  approveByHOD: (id, payload = {}) => api.put(`/hr/manual-salary/${id}/approve-hod`, payload),
  rejectByHOD: (id, payload = {}) => api.put(`/hr/manual-salary/${id}/reject-hod`, payload),
  approveByAVP: (id, payload = {}) => api.put(`/hr/manual-salary/${id}/approve-avp`, payload),
  rejectByAVP: (id, payload = {}) => api.put(`/hr/manual-salary/${id}/reject-avp`, payload),
  approveByCEO: (id, payload = {}) => api.put(`/hr/manual-salary/${id}/approve-ceo`, payload),
  rejectByCEO: (id, payload = {}) => api.put(`/hr/manual-salary/${id}/reject-ceo`, payload),
  returnByCEO: (id, payload = {}) => api.put(`/hr/manual-salary/${id}/return-ceo`, payload)
};

export default manualSalaryService;

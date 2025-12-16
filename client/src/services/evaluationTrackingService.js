import api from './api';

const evaluationTrackingService = {
  getAll: (params = {}) => api.get('/evaluation-documents/tracking', { params }),
  getById: (id) => api.get(`/evaluation-documents/${id}/tracking`)
};

export default evaluationTrackingService;











































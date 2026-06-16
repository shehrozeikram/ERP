import api from './api';

const surveyService = {
  getSurveys: (params = {}) => api.get('/crm/surveys', { params }),

  getAssignableUsers: () => api.get('/crm/surveys/assignable-users'),

  getMySurveys: () => api.get('/crm/surveys/my'),

  getSurvey: (id) => api.get(`/crm/surveys/${id}`),

  createSurvey: (payload) => api.post('/crm/surveys', payload),

  updateSurvey: (id, payload) => api.put(`/crm/surveys/${id}`, payload),

  publishSurvey: (id, payload = {}) => api.post(`/crm/surveys/${id}/publish`, payload),

  deleteSurvey: (id) => api.delete(`/crm/surveys/${id}`),

  submitResponse: (id, answers) => api.post(`/crm/surveys/${id}/responses`, { answers }),

  getResponses: (id) => api.get(`/crm/surveys/${id}/responses`),

  getAnalytics: (id) => api.get(`/crm/surveys/${id}/analytics`),

  getExecutiveDashboard: () => api.get('/crm/surveys/executive-dashboard'),

  getPollResults: (id) => api.get(`/crm/surveys/${id}/poll-results`),

  getCommcraftReview: (id) => api.get(`/crm/surveys/${id}/commcraft-review`),

  saveCommcraftReview: (id, payload) => api.put(`/crm/surveys/${id}/commcraft-review`, payload)
};

export default surveyService;

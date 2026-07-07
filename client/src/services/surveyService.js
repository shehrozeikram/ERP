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

  saveInternalAnswers: (id, responseId, answers) => api.patch(`/crm/surveys/${id}/responses/${responseId}/internal`, { answers }),

  getAnalytics: (id) => api.get(`/crm/surveys/${id}/analytics`),

  getExecutiveDashboard: () => api.get('/crm/surveys/executive-dashboard'),

  getPollResults: (id) => api.get(`/crm/surveys/${id}/poll-results`),

  getCommcraftReview: (id) => api.get(`/crm/surveys/${id}/commcraft-review`),

  saveCommcraftReview: (id, payload) => api.put(`/crm/surveys/${id}/commcraft-review`, payload),

  saveAnalysisReport: (id, payload) => api.post(`/crm/surveys/${id}/analysis-report`, payload),

  uploadAnalysisAttachment: (id, formData) => api.post(`/crm/surveys/${id}/analysis-report/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  sendAnalysisReport: (id, payload) => api.post(`/crm/surveys/${id}/analysis-report/send`, payload)
};

export default surveyService;

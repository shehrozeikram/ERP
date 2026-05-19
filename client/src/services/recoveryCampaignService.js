import api from './api';

const base = '/finance/recovery-campaigns';

export const fetchRecoveryCampaigns = (params = {}) => api.get(base, { params });

export const createRecoveryCampaign = (data) => api.post(base, data);

export const updateRecoveryCampaign = (id, data) => api.put(`${base}/${id}`, data);

export const deleteRecoveryCampaign = (id) => api.delete(`${base}/${id}`);

export const fetchRecoveryFollowUpSettings = () => api.get(`${base}/follow-up-settings`);

export const saveRecoveryFollowUpSettings = (data) => api.put(`${base}/follow-up-settings`, data);

export const runRecoveryFollowUpNow = () => api.post(`${base}/follow-up-settings/run-now`);

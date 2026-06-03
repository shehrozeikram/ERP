import api from './api';

const base = '/finance/recovery-campaigns';

export const fetchRecoveryCampaigns = (params = {}) => api.get(base, { params });

export const createRecoveryCampaign = (data) => api.post(base, data);

export const updateRecoveryCampaign = (id, data) => api.put(`${base}/${id}`, data);

export const deleteRecoveryCampaign = (id) => api.delete(`${base}/${id}`);

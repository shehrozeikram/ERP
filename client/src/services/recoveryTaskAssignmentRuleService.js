import api from './api';

const base = '/finance/recovery-task-rules';

export const fetchRecoveryTaskRules = () => api.get(base);

export const createRecoveryTaskRule = (data) => api.post(base, data);

export const updateRecoveryTaskRule = (id, data) => api.put(`${base}/${id}`, data);

export const deleteRecoveryTaskRule = (id) => api.delete(`${base}/${id}`);

export const fetchSlabTargetCount = (params = {}) =>
  api.get(`${base}/slab-target-count`, { params });

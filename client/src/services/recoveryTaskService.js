import api from './api';

const base = '/finance/recovery-tasks';

export const fetchRecoveryTasks = (params = {}) => api.get(base, { params });

export const createRecoveryTask = (data) => api.post(base, data);

export const updateRecoveryTask = (id, data) => api.put(`${base}/${id}`, data);

export const deleteRecoveryTask = (id) => api.delete(`${base}/${id}`);

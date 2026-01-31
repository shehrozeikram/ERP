import api from './api';

const base = '/finance/recovery-members';

export const fetchRecoveryMembers = (params = {}) =>
  api.get(base, { params });

export const createRecoveryMember = (data) =>
  api.post(base, data);

export const updateRecoveryMember = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteRecoveryMember = (id) =>
  api.delete(`${base}/${id}`);

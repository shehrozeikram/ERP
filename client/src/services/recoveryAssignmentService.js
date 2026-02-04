import api from './api';

const base = '/finance/recovery-assignments';

export const fetchRecoveryAssignments = (params = {}) =>
  api.get(base, { params });

export const fetchRecoveryAssignmentStats = () =>
  api.get(`${base}/stats`);

export const importRecoveryAssignments = (records) =>
  api.post(`${base}/import`, { records });

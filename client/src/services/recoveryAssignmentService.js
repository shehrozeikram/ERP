import api from './api';

const base = '/finance/recovery-assignments';

export const fetchRecoveryAssignments = (params = {}) =>
  api.get(base, { params });

export const fetchMyRecoveryTasks = (params = {}) =>
  api.get(`${base}/my-tasks`, { params });

export const updateRecoveryAssignmentFeedback = (id, data) =>
  api.put(`${base}/${id}/feedback`, data);

export const sendRecoveryWhatsApp = (payload) =>
  api.post(`${base}/send-whatsapp`, payload);

export const fetchWhatsAppIncomingMessages = (from) =>
  api.get(`${base}/whatsapp-incoming`, { params: { from } });

export const fetchWhatsAppNumbersWithMessages = () =>
  api.get(`${base}/whatsapp-incoming/numbers-with-messages`);

export const fetchRecoveryAssignmentStats = () =>
  api.get(`${base}/stats`);

export const importRecoveryAssignments = (records) =>
  api.post(`${base}/import`, { records });

export const importRecoveryAssignmentsFromLatestFile = () =>
  api.post(`${base}/import-latest`);

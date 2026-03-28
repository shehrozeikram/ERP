import api from './api';

const base = '/finance/recovery-assignments';

export const fetchRecoveryAssignments = (params = {}) =>
  api.get(base, { params });

export const createRecoveryAssignment = (data) =>
  api.post(base, data);

export const updateRecoveryAssignment = (id, data) =>
  api.put(`${base}/${id}`, data);

export const fetchMyRecoveryTasks = (params = {}) =>
  api.get(`${base}/my-tasks`, { params });

export const updateRecoveryAssignmentFeedback = (id, data) =>
  api.put(`${base}/${id}/feedback`, data);

export const sendRecoveryWhatsApp = (payload) =>
  api.post(`${base}/send-whatsapp`, payload);

export const uploadWhatsAppMedia = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`${base}/upload-media`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const fetchWhatsAppIncomingMessages = (from) =>
  api.get(`${base}/whatsapp-incoming`, { params: { from } });

export const fetchWhatsAppNumbersWithMessages = () =>
  api.get(`${base}/whatsapp-incoming/numbers-with-messages`);

export const markRecoveryWhatsAppRead = (phone) =>
  api.post(`${base}/whatsapp-incoming/mark-read`, { phone });

export const fetchRecoveryAssignmentStats = (params = {}) =>
  api.get(`${base}/stats`, { params });

export const importRecoveryAssignments = (records) =>
  api.post(`${base}/import`, { records });

export const importRecoveryAssignmentsFromLatestFile = () =>
  api.post(`${base}/import-latest`);

export const importRecoveryAssignmentsFromFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`${base}/import-file`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const fetchRecoveryImportFormat = () =>
  api.get(`${base}/import-format`);

export const downloadRecoverySampleExcel = () =>
  api.get(`${base}/import-format`, { params: { download: 1 }, responseType: 'blob' });

export const completeRecoveryTask = (id) =>
  api.put(`${base}/${id}/complete`);

export const fetchCompletedRecoveryTasks = (params = {}) =>
  api.get(`${base}/completed-tasks`, { params });

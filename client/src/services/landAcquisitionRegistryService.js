import api from './api';

const BASE = '/taj-residencia/land-acquisition';

export const getRegistries = (params = {}) => api.get(`${BASE}/registries`, { params });

export const getRegistry = (id) => api.get(`${BASE}/registries/${id}`);

export const getRegisteredTotals = (moza, excludeRegistryId) => api.get(`${BASE}/registries/registered-totals`, {
  params: { moza, ...(excludeRegistryId ? { excludeRegistryId } : {}) }
});

const buildRegistryFormData = (data, files = [], removedAttachmentIds = []) => {
  const form = new FormData();
  form.append('data', JSON.stringify({
    ...data,
    ...(removedAttachmentIds.length ? { removedAttachmentIds } : {})
  }));
  files.forEach((file) => form.append('attachments', file));
  return form;
};

export const createRegistry = (data, files = []) => {
  if (!files?.length) {
    return api.post(`${BASE}/registries`, data);
  }
  return api.post(`${BASE}/registries`, buildRegistryFormData(data, files), {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const updateRegistry = (id, data, files = [], removedAttachmentIds = []) => {
  if (!files?.length && !removedAttachmentIds?.length) {
    return api.put(`${BASE}/registries/${id}`, data);
  }
  return api.put(`${BASE}/registries/${id}`, buildRegistryFormData(data, files, removedAttachmentIds), {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const deleteRegistry = (id) => api.delete(`${BASE}/registries/${id}`);

export default {
  getRegistries,
  getRegistry,
  getRegisteredTotals,
  createRegistry,
  updateRegistry,
  deleteRegistry
};

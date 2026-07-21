import api from './api';

const BASE = '/taj-residencia/land-acquisition';

export const getRegistries = (params = {}) => api.get(`${BASE}/registries`, { params });

export const getRegistry = (id) => api.get(`${BASE}/registries/${id}`);

export const getRegisteredTotals = (moza, excludeRegistryId) => api.get(`${BASE}/registries/registered-totals`, {
  params: { moza, ...(excludeRegistryId ? { excludeRegistryId } : {}) }
});

const buildRegistryFormData = (data, options = {}) => {
  const {
    files = [],
    removedAttachmentIds = [],
    registryDocFiles = [],
    removedRegistryDocAttachmentIds = [],
    inteqalDocFiles = [],
    removedInteqalDocAttachmentIds = []
  } = options;

  const form = new FormData();
  form.append('data', JSON.stringify({
    ...data,
    ...(removedAttachmentIds.length ? { removedAttachmentIds } : {}),
    ...(removedRegistryDocAttachmentIds.length ? { removedRegistryDocAttachmentIds } : {}),
    ...(removedInteqalDocAttachmentIds.length ? { removedInteqalDocAttachmentIds } : {})
  }));

  (files || []).forEach((file) => form.append('attachments', file));
  (registryDocFiles || []).forEach((file) => form.append('registryDocAttachments', file));
  (inteqalDocFiles || []).forEach((file) => form.append('inteqalDocAttachments', file));

  return form;
};

export const createRegistry = (data, options = {}) => {
  const { files = [], registryDocFiles = [], inteqalDocFiles = [] } = typeof options === 'object' && !Array.isArray(options) ? options : { files: options };
  if (!files?.length && !registryDocFiles?.length && !inteqalDocFiles?.length) {
    return api.post(`${BASE}/registries`, data);
  }
  const opts = typeof options === 'object' && !Array.isArray(options) ? options : { files: options };
  return api.post(`${BASE}/registries`, buildRegistryFormData(data, opts), {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const updateRegistry = (id, data, options = {}, legacyRemovedIds = []) => {
  const opts = typeof options === 'object' && !Array.isArray(options) ? options : { files: options, removedAttachmentIds: legacyRemovedIds };
  const { files = [], registryDocFiles = [], inteqalDocFiles = [], removedAttachmentIds = [], removedRegistryDocAttachmentIds = [], removedInteqalDocAttachmentIds = [] } = opts;

  if (!files?.length && !registryDocFiles?.length && !inteqalDocFiles?.length && !removedAttachmentIds?.length && !removedRegistryDocAttachmentIds?.length && !removedInteqalDocAttachmentIds?.length) {
    return api.put(`${BASE}/registries/${id}`, data);
  }
  return api.put(`${BASE}/registries/${id}`, buildRegistryFormData(data, opts), {
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

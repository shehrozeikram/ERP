import api from './api';

const BASE = '/taj-residencia/land-acquisition';

export const getMozas = () => api.get(`${BASE}/mozas`);

export const getMozaEntries = (mozaId, params = {}) =>
  api.get(`${BASE}/mozas/${mozaId}/entries`, { params });

export const getMozaKhewats = (mozaId) => api.get(`${BASE}/mozas/${mozaId}/khewats`);

export const getMozaKhasras = (mozaId, params = {}) =>
  api.get(`${BASE}/mozas/${mozaId}/khasras`, { params });

export const createMoza = (data) => api.post(`${BASE}/mozas`, data);

export const updateMoza = (mozaId, data) => api.put(`${BASE}/mozas/${mozaId}`, data);

export const deleteMoza = (mozaId) => api.delete(`${BASE}/mozas/${mozaId}`);

export const getMozaEntriesMeta = (mozaId) =>
  api.get(`${BASE}/mozas/${mozaId}/entries/meta`);

export const createMozaEntry = (mozaId, data) =>
  api.post(`${BASE}/mozas/${mozaId}/entries`, data);

export const updateMozaEntry = (mozaId, entryId, data) =>
  api.put(`${BASE}/mozas/${mozaId}/entries/${entryId}`, data);

export const deleteMozaEntry = (mozaId, entryId) =>
  api.delete(`${BASE}/mozas/${mozaId}/entries/${entryId}`);

export const importMozaExcel = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`${BASE}/mozas/import`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

const landAcquisitionMozaService = {
  getMozas,
  getMozaEntries,
  getMozaKhewats,
  getMozaKhasras,
  getMozaEntriesMeta,
  createMoza,
  updateMoza,
  deleteMoza,
  createMozaEntry,
  updateMozaEntry,
  deleteMozaEntry,
  importMozaExcel
};

export default landAcquisitionMozaService;

import api from './api';

const base = '/taj-utilities/sectors';

export const fetchSectors = (params = {}) =>
  api.get(base, { params });

export const fetchSectorById = (id) =>
  api.get(`${base}/${id}`);

export const createSector = (data) =>
  api.post(base, data);

export const updateSector = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteSector = (id) =>
  api.delete(`${base}/${id}`);

export default {
  fetchSectors,
  fetchSectorById,
  createSector,
  updateSector,
  deleteSector
};


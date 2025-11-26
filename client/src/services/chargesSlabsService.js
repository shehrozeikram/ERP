import api from './api';

const base = '/taj-utilities/charges-slabs';

export const fetchChargesSlabs = () =>
  api.get(base);

export const fetchChargesSlabById = (id) =>
  api.get(`${base}/${id}`);

export const fetchActiveChargesSlabs = () =>
  api.get(`${base}/active`);

export const createChargesSlabs = (data) =>
  api.post(base, data);

export const updateChargesSlabs = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteChargesSlabs = (id) =>
  api.delete(`${base}/${id}`);

export default {
  fetchChargesSlabs,
  fetchChargesSlabById,
  fetchActiveChargesSlabs,
  createChargesSlabs,
  updateChargesSlabs,
  deleteChargesSlabs
};


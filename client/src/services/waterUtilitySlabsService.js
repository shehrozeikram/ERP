import api from './api';

const base = '/taj-utilities/water-utility-slabs';

export const fetchWaterUtilitySlabs = () =>
  api.get(base);

export const fetchWaterUtilitySlabById = (id) =>
  api.get(`${base}/${id}`);

export const fetchActiveWaterUtilitySlabs = () =>
  api.get(`${base}/active`);

export const createWaterUtilitySlabs = (data) =>
  api.post(base, data);

export const updateWaterUtilitySlabs = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteWaterUtilitySlabs = (id) =>
  api.delete(`${base}/${id}`);

export default {
  fetchWaterUtilitySlabs,
  fetchWaterUtilitySlabById,
  fetchActiveWaterUtilitySlabs,
  createWaterUtilitySlabs,
  updateWaterUtilitySlabs,
  deleteWaterUtilitySlabs
};


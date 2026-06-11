import api from './api';

const BASE = '/taj-residencia/land-acquisition';

export const getPossessionStatus = (params) =>
  api.get(`${BASE}/possession-status`, { params });

export const getPossessions = (params = {}) =>
  api.get(`${BASE}/possessions`, { params });

export const getPossession = (id) =>
  api.get(`${BASE}/possessions/${id}`);

export const getNextPossessionRef = (moza) =>
  api.get(`${BASE}/possessions/next-ref`, { params: { moza } });

export const getPossessedTotals = (moza, excludePossessionId) => api.get(`${BASE}/possessions/possessed-totals`, {
  params: { moza, ...(excludePossessionId ? { excludePossessionId } : {}) }
});

export const createPossession = (data) =>
  api.post(`${BASE}/possessions`, data);

export const updatePossession = (id, data) =>
  api.put(`${BASE}/possessions/${id}`, data);

export const deletePossession = (id) =>
  api.delete(`${BASE}/possessions/${id}`);

export default {
  getPossessionStatus,
  getPossessions,
  getPossession,
  getNextPossessionRef,
  getPossessedTotals,
  createPossession,
  updatePossession,
  deletePossession
};

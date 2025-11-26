import api from './api';

const base = '/taj-utilities/cam-charges';

export const fetchCAMCharges = (params = {}) =>
  api.get(base, { params });

export const fetchCAMChargeById = (id) =>
  api.get(`${base}/${id}`);

export const createCAMCharge = (data) =>
  api.post(base, data);

export const updateCAMCharge = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteCAMCharge = (id) =>
  api.delete(`${base}/${id}`);

export const bulkCreateCAMCharges = (data) =>
  api.post(`${base}/bulk-create`, data);

export default {
  fetchCAMCharges,
  fetchCAMChargeById,
  createCAMCharge,
  updateCAMCharge,
  deleteCAMCharge,
  bulkCreateCAMCharges
};


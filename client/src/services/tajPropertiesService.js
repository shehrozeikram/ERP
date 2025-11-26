import api from './api';

const base = '/taj-utilities/properties';

export const fetchProperties = (params = {}) =>
  api.get(base, { params });

export const fetchPropertyById = (id) =>
  api.get(`${base}/${id}`);

export const createProperty = (data) =>
  api.post(base, data);

export const updateProperty = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteProperty = (id) =>
  api.delete(`${base}/${id}`);

export const updatePropertyStatus = (id, status) =>
  api.patch(`${base}/${id}/status`, { status });

export default {
  fetchProperties,
  fetchPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  updatePropertyStatus
};


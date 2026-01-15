import api from './api';

const base = '/taj-utilities/charge-types';

export const fetchChargeTypes = async (params = {}) => {
  return api.get(base, { params });
};

export const fetchChargeTypeById = async (id) => {
  return api.get(`${base}/${id}`);
};

export const createChargeType = async (data) => {
  return api.post(base, data);
};

export const updateChargeType = async (id, data) => {
  return api.put(`${base}/${id}`, data);
};

export const deleteChargeType = async (id) => {
  return api.delete(`${base}/${id}`);
};

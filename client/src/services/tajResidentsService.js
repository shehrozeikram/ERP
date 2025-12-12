import api from './api';

const base = '/taj-utilities/residents';

export const fetchResidents = (params = {}) =>
  api.get(base, { params });

export const fetchResidentById = (id) =>
  api.get(`${base}/${id}`);

export const createResident = (data) =>
  api.post(base, data);

export const updateResident = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteResident = (id) =>
  api.delete(`${base}/${id}`);

export const fetchResidentTransactions = (id, params = {}) =>
  api.get(`${base}/${id}/transactions`, { params });

export const depositMoney = (id, data) =>
  api.post(`${base}/${id}/deposit`, data);

export const transferMoney = (id, data) =>
  api.post(`${base}/${id}/transfer`, data);

export const payBill = (id, data) =>
  api.post(`${base}/${id}/pay`, data);

export const assignProperties = (id, propertyIds) =>
  api.post(`${base}/${id}/assign-properties`, { propertyIds });

export const unassignProperties = (id, propertyIds) =>
  api.post(`${base}/${id}/unassign-properties`, { propertyIds });

export const autoMatchProperties = (id) =>
  api.post(`${base}/${id}/auto-match-properties`);

export const getUnassignedProperties = (params = {}) =>
  api.get(`${base}/unassigned-properties`, { params });


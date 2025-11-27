import api from './api';

const base = '/taj-utilities/electricity';

export const fetchElectricity = (params = {}) =>
  api.get(base, { params });

export const fetchElectricityById = (id) =>
  api.get(`${base}/${id}`);

export const createElectricity = (data) =>
  api.post(base, data);

export const updateElectricity = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteElectricity = (id) =>
  api.delete(`${base}/${id}`);

export const bulkCreateElectricityBills = (data) =>
  api.post(`${base}/bulk-create`, data);

export const addPaymentToElectricityBill = (billId, paymentData) =>
  api.post(`${base}/${billId}/payments`, paymentData);

export const addPaymentToPropertyElectricity = (propertyId, paymentData) =>
  api.post(`${base}/property/${propertyId}/payments`, paymentData);

export const deletePaymentFromElectricityBill = (billId, paymentId) =>
  api.delete(`${base}/${billId}/payments/${paymentId}`);

export default {
  fetchElectricity,
  fetchElectricityById,
  createElectricity,
  updateElectricity,
  deleteElectricity,
  bulkCreateElectricityBills,
  addPaymentToElectricityBill,
  addPaymentToPropertyElectricity,
  deletePaymentFromElectricityBill
};


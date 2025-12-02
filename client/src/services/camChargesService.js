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

const postPayment = (url, paymentData) => {
  const config =
    paymentData instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
  return api.post(url, paymentData, config);
};

export const addPaymentToCAMCharge = (chargeId, paymentData) =>
  postPayment(`${base}/${chargeId}/payments`, paymentData);

export const addPaymentToPropertyCAM = (propertyId, paymentData) =>
  postPayment(`${base}/property/${propertyId}/payments`, paymentData);

export const deletePaymentFromCAMCharge = (chargeId, paymentId) =>
  api.delete(`${base}/${chargeId}/payments/${paymentId}`);

export const fetchLatestCAMChargeForProperty = (propertyId) =>
  api.get(`${base}/property/${propertyId}/latest-charge`);

const camChargesService = {
  fetchCAMCharges,
  fetchCAMChargeById,
  createCAMCharge,
  updateCAMCharge,
  deleteCAMCharge,
  bulkCreateCAMCharges,
  addPaymentToCAMCharge,
  addPaymentToPropertyCAM,
  deletePaymentFromCAMCharge,
  fetchLatestCAMChargeForProperty
};

export default camChargesService;


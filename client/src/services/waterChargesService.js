import api from './api';

const base = '/taj-utilities/water-charges';

export const fetchWaterCharges = (params = {}) =>
  api.get(base, { params });

export const fetchWaterChargeById = (id) =>
  api.get(`${base}/${id}`);

export const createWaterCharge = (data) =>
  api.post(base, data);

export const updateWaterCharge = (id, data) =>
  api.put(`${base}/${id}`, data);

export const deleteWaterCharge = (id) =>
  api.delete(`${base}/${id}`);

export const bulkCreateWaterCharges = (data) =>
  api.post(`${base}/bulk-create`, data);

const postPayment = (url, paymentData) => {
  const config =
    paymentData instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
  return api.post(url, paymentData, config);
};

export const addPaymentToWaterCharge = (chargeId, paymentData) =>
  postPayment(`${base}/${chargeId}/payments`, paymentData);

export const addPaymentToPropertyWater = (propertyId, paymentData) =>
  postPayment(`${base}/property/${propertyId}/payments`, paymentData);

export const deletePaymentFromWaterCharge = (chargeId, paymentId) =>
  api.delete(`${base}/${chargeId}/payments/${paymentId}`);

export const fetchLatestWaterChargeForProperty = (propertyId) =>
  api.get(`${base}/property/${propertyId}/latest-charge`);

const waterChargesService = {
  fetchWaterCharges,
  fetchWaterChargeById,
  createWaterCharge,
  updateWaterCharge,
  deleteWaterCharge,
  bulkCreateWaterCharges,
  addPaymentToWaterCharge,
  addPaymentToPropertyWater,
  deletePaymentFromWaterCharge,
  fetchLatestWaterChargeForProperty
};

export default waterChargesService;

import api from './api';

const base = '/taj-utilities/rental-management';

// Property endpoints
export const fetchProperties = (params = {}) =>
  api.get(`${base}/properties`, { params });

export const fetchGeneralRentalProperties = (params = {}) =>
  api.get(`${base}/general-properties`, { params });

export const fetchPropertyById = (id) =>
  api.get(`${base}/properties/${id}`);

// Payment endpoints
export const addPayment = (propertyId, paymentData) => {
  const config =
    paymentData instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined;
  return api.post(`${base}/properties/${propertyId}/payments`, paymentData, config);
};

export const fetchInvoice = (propertyId, paymentId) =>
  api.get(`${base}/properties/${propertyId}/invoice/${paymentId}`);

export const updatePaymentStatus = (propertyId, paymentId, status) =>
  api.patch(`${base}/properties/${propertyId}/payments/${paymentId}/status`, { status });

export const deletePayment = (propertyId, paymentId) =>
  api.delete(`${base}/properties/${propertyId}/payments/${paymentId}`);

export const fetchLatestRentInvoiceForProperty = (propertyId) =>
  api.get(`${base}/properties/${propertyId}/latest-invoice`);

// Agreements endpoint
export const fetchAvailableAgreements = () =>
  api.get(`${base}/agreements/available`);

export default {
  fetchProperties,
  fetchGeneralRentalProperties,
  fetchPropertyById,
  addPayment,
  fetchInvoice,
  fetchLatestRentInvoiceForProperty,
  fetchAvailableAgreements,
  updatePaymentStatus,
  deletePayment
};


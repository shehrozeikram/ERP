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
export const addPayment = (propertyId, paymentData) =>
  api.post(`${base}/properties/${propertyId}/payments`, paymentData);

export const fetchInvoice = (propertyId, paymentId) =>
  api.get(`${base}/properties/${propertyId}/invoice/${paymentId}`);

export const updatePaymentStatus = (propertyId, paymentId, status) =>
  api.patch(`${base}/properties/${propertyId}/payments/${paymentId}/status`, { status });

// Agreements endpoint
export const fetchAvailableAgreements = () =>
  api.get(`${base}/agreements/available`);

export default {
  fetchProperties,
  fetchGeneralRentalProperties,
  fetchPropertyById,
  addPayment,
  fetchInvoice,
  fetchAvailableAgreements,
  updatePaymentStatus
};


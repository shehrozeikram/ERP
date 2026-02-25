import api from './api';

const base = '/taj-utilities/invoices';

export const createInvoice = (propertyId, data) => {
  if (propertyId) {
    return api.post(`${base}/property/${propertyId}`, data);
  } else {
    // Create open invoice without property
    return api.post(base, data);
  }
};

export const fetchInvoice = (invoiceId) =>
  api.get(`${base}/${invoiceId}`);

export const fetchInvoicesForProperty = (propertyId) =>
  api.get(`${base}/property/${propertyId}`);

export const fetchAllInvoices = (params = {}) =>
  api.get(base, { params });

export const fetchReports = (params = {}) =>
  api.get(`${base}/reports`, { params });

export const fetchMonthSummary = (params = {}) =>
  api.get(`${base}/month-summary`, { params });

export const fetchReconciliationRecords = (params = {}) =>
  api.get(`${base}/reconciliation`, { params });

export const saveReconciliation = (formData) =>
  api.post(`${base}/reconciliation/save`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

export const updateInvoice = (invoiceId, data) =>
  api.put(`${base}/${invoiceId}`, data);

export const deleteInvoice = (invoiceId) =>
  api.delete(`${base}/${invoiceId}`);

export const deletePaymentFromInvoice = (invoiceId, paymentId) =>
  api.delete(`${base}/${invoiceId}/payments/${paymentId}`);

export const getElectricityCalculation = (propertyId, currentReading, meterNo, unitsConsumed, previousReading) => {
  const params = {};
  
  // Include manual previous reading if provided
  if (previousReading !== undefined && previousReading !== null && previousReading !== '') {
    params.previousReading = previousReading;
  }
  
  // CRITICAL: If unitsConsumed is provided, ONLY send unitsConsumed (ignore currentReading)
  if (unitsConsumed !== undefined && unitsConsumed !== null && unitsConsumed !== '') {
    params.unitsConsumed = unitsConsumed;
    // Explicitly do NOT send currentReading when unitsConsumed is provided
  } else if (currentReading !== undefined && currentReading !== null && currentReading !== '') {
    // Only send currentReading if unitsConsumed is NOT provided
    params.currentReading = currentReading;
  }
  
  // Always include meterNo if provided
  if (meterNo) {
    params.meterNo = meterNo;
  }
  
  console.log('[getElectricityCalculation] Params:', params);
  
  return api.get(`${base}/property/${propertyId}/electricity-calculation`, { params });
};

export const getRentCalculation = (propertyId) =>
  api.get(`${base}/property/${propertyId}/rent-calculation`);

export const getCAMCalculation = (propertyId) =>
  api.get(`${base}/property/${propertyId}/cam-calculation`);

const propertyInvoiceService = {
  createInvoice,
  fetchInvoice,
  fetchInvoicesForProperty,
  fetchAllInvoices,
  fetchReports,
  updateInvoice,
  deleteInvoice,
  deletePaymentFromInvoice,
  getElectricityCalculation,
  getRentCalculation,
  getCAMCalculation
};

export default propertyInvoiceService;


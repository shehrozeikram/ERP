import api from './api';

const base = '/taj-utilities/invoices';

export const createInvoice = (propertyId, data) =>
  api.post(`${base}/property/${propertyId}`, data);

export const fetchInvoice = (invoiceId) =>
  api.get(`${base}/${invoiceId}`);

export const fetchInvoicesForProperty = (propertyId) =>
  api.get(`${base}/property/${propertyId}`);

export const fetchAllInvoices = (params = {}) =>
  api.get(base, { params });

export const updateInvoice = (invoiceId, data) =>
  api.put(`${base}/${invoiceId}`, data);

export const deleteInvoice = (invoiceId) =>
  api.delete(`${base}/${invoiceId}`);

export const getElectricityCalculation = (propertyId, currentReading, meterNo) =>
  api.get(`${base}/property/${propertyId}/electricity-calculation`, {
    params: {
      ...(currentReading !== undefined ? { currentReading } : {}),
      ...(meterNo ? { meterNo } : {})
    }
  });

const propertyInvoiceService = {
  createInvoice,
  fetchInvoice,
  fetchInvoicesForProperty,
  fetchAllInvoices,
  updateInvoice,
  deleteInvoice
};

export default propertyInvoiceService;


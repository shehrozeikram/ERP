import api from './api';

const base = '/taj-utilities/receipts';

export const fetchInvoicesForProperty = (propertyId) =>
  api.get(`${base}/property/${propertyId}/invoices`);

export const createReceipt = (data) =>
  api.post(base, data);

export const fetchReceipts = (params = {}) =>
  api.get(base, { params });

export const fetchReceipt = (receiptId) =>
  api.get(`${base}/${receiptId}`);

export const deleteReceipt = (receiptId) =>
  api.delete(`${base}/${receiptId}`);

export default {
  fetchInvoicesForProperty,
  createReceipt,
  fetchReceipts,
  fetchReceipt,
  deleteReceipt
};


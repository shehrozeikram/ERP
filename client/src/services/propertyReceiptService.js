import api from './api';

const base = '/taj-utilities/receipts';

// Get invoices for property (for allocation) - ESSENTIAL
export const fetchInvoicesForProperty = (propertyId) =>
  api.get(`${base}/property/${propertyId}/invoices`);

// Create receipt with allocations
export const createReceipt = (data) =>
  api.post(base, data);

// Get all receipts
export const fetchReceipts = (params = {}) =>
  api.get(base, { params });

// Get receipt by ID
export const fetchReceipt = (receiptId) =>
  api.get(`${base}/${receiptId}`);

// Delete receipt
export const deleteReceipt = (receiptId) =>
  api.delete(`${base}/${receiptId}`);

export default {
  fetchInvoicesForProperty,
  createReceipt,
  fetchReceipts,
  fetchReceipt,
  deleteReceipt
};


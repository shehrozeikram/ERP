import api from './api';

const BASE = '/taj-residencia/land-acquisition';

const landAcquisitionPurchaseService = {
  getNextNumbers: async () => {
    const response = await api.get(`${BASE}/purchases/next-numbers`);
    return response.data;
  },

  getDeals: async () => {
    const response = await api.get(`${BASE}/purchases/deals`);
    return response.data;
  },

  getPurchases: async (params = {}) => {
    const response = await api.get(`${BASE}/purchases`, { params });
    return response.data;
  },

  getPurchase: async (id) => {
    const response = await api.get(`${BASE}/purchases/${id}`);
    return response.data;
  },

  createPurchase: async (payload) => {
    const response = await api.post(`${BASE}/purchases`, payload);
    return response.data;
  },

  updatePurchase: async (id, payload) => {
    const response = await api.put(`${BASE}/purchases/${id}`, payload);
    return response.data;
  },

  updatePurchasePayment: async (id, payload) => {
    const response = await api.patch(`${BASE}/purchases/${id}/payment`, payload);
    return response.data;
  },

  addInstallment: async (purchaseId, payload) => {
    const response = await api.post(`${BASE}/purchases/${purchaseId}/installments`, payload);
    return response.data;
  },

  updateInstallment: async (purchaseId, installmentId, payload) => {
    const response = await api.put(`${BASE}/purchases/${purchaseId}/installments/${installmentId}`, payload);
    return response.data;
  },

  payInstallment: async (purchaseId, installmentId, payload) => {
    const response = await api.patch(`${BASE}/purchases/${purchaseId}/installments/${installmentId}/pay`, payload);
    return response.data;
  },

  payMultipleInstallments: async (purchaseId, payload) => {
    const response = await api.post(`${BASE}/purchases/${purchaseId}/installments/pay-bulk`, payload);
    return response.data;
  },

  deleteInstallment: async (purchaseId, installmentId) => {
    const response = await api.delete(`${BASE}/purchases/${purchaseId}/installments/${installmentId}`);
    return response.data;
  },

  deletePurchase: async (id) => {
    const response = await api.delete(`${BASE}/purchases/${id}`);
    return response.data;
  }
};

export default landAcquisitionPurchaseService;

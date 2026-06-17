import api from './api';

const BASE = '/taj-residencia/land-acquisition';

const landAcquisitionPurchaseService = {
  getNextNumbers: async () => {
    const response = await api.get(`${BASE}/purchases/next-numbers`);
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

  deletePurchase: async (id) => {
    const response = await api.delete(`${BASE}/purchases/${id}`);
    return response.data;
  }
};

export default landAcquisitionPurchaseService;

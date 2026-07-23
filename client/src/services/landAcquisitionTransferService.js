import api from './api';

const BASE = '/taj-residencia/land-acquisition';

const landAcquisitionTransferService = {
  getNextNumbers: async () => {
    const response = await api.get(`${BASE}/transfers/next-numbers`);
    return response.data;
  },

  getTransfers: async (params = {}) => {
    const response = await api.get(`${BASE}/transfers`, { params });
    return response.data;
  },

  getTransfer: async (id) => {
    const response = await api.get(`${BASE}/transfers/${id}`);
    return response.data;
  },

  createTransfer: async (payload) => {
    let data = payload;
    let config = {};
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      data = payload;
      config = { headers: { 'Content-Type': 'multipart/form-data' } };
    }
    const response = await api.post(`${BASE}/transfers`, data, config);
    return response.data;
  },

  updateTransfer: async (id, payload) => {
    let data = payload;
    let config = {};
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      data = payload;
      config = { headers: { 'Content-Type': 'multipart/form-data' } };
    }
    const response = await api.put(`${BASE}/transfers/${id}`, data, config);
    return response.data;
  },

  closeTransfer: async (id) => {
    const response = await api.patch(`${BASE}/transfers/${id}/close`);
    return response.data;
  },

  addTransferPayment: async (id, payload) => {
    const response = await api.post(`${BASE}/transfers/${id}/payments`, payload);
    return response.data;
  },

  deleteTransfer: async (id) => {
    const response = await api.delete(`${BASE}/transfers/${id}`);
    return response.data;
  },

  getLandSummaryReport: async () => {
    const response = await api.get(`${BASE}/reports/land-summary`);
    return response.data;
  }
};

export default landAcquisitionTransferService;

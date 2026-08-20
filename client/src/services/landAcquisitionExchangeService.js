import api from './api';

const BASE = '/taj-residencia/land-acquisition';

const landAcquisitionExchangeService = {
  getNextExchangeRef: async () => {
    const response = await api.get(`${BASE}/exchanges/next-ref`);
    return response.data;
  },

  getExchanges: async (params = {}) => {
    const response = await api.get(`${BASE}/exchanges`, { params });
    return response.data;
  },

  getExchange: async (id) => {
    const response = await api.get(`${BASE}/exchanges/${id}`);
    return response.data;
  },

  createExchange: async (payload) => {
    let data = payload;
    let config = {};
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      data = payload;
      config = { headers: { 'Content-Type': 'multipart/form-data' } };
    }
    const response = await api.post(`${BASE}/exchanges`, data, config);
    return response.data;
  },

  updateExchange: async (id, payload) => {
    let data = payload;
    let config = {};
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      data = payload;
      config = { headers: { 'Content-Type': 'multipart/form-data' } };
    }
    const response = await api.put(`${BASE}/exchanges/${id}`, data, config);
    return response.data;
  },

  deleteExchange: async (id) => {
    const response = await api.delete(`${BASE}/exchanges/${id}`);
    return response.data;
  }
};

export default landAcquisitionExchangeService;

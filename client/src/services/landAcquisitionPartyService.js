import api from './api';

const BASE = '/taj-residencia/land-acquisition/parties';

const landAcquisitionPartyService = {
  getParties: async (params = {}) => {
    const response = await api.get(BASE, { params });
    return response.data;
  },

  getParty: async (id) => {
    const response = await api.get(`${BASE}/${id}`);
    return response.data;
  },

  createParty: async (payload) => {
    const response = await api.post(BASE, payload);
    return response.data;
  },

  updateParty: async (id, payload) => {
    const response = await api.put(`${BASE}/${id}`, payload);
    return response.data;
  },

  deleteParty: async (id) => {
    const response = await api.delete(`${BASE}/${id}`);
    return response.data;
  }
};

export default landAcquisitionPartyService;

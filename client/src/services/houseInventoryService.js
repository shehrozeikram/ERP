import api from './api';

const houseInventoryService = {
  getHouses: async () => {
    const response = await api.get('/house-inventory/houses');
    return response.data;
  },

  createHouse: async (payload) => {
    const response = await api.post('/house-inventory/houses', payload);
    return response.data;
  },

  updateHouse: async (id, payload) => {
    const response = await api.put(`/house-inventory/houses/${id}`, payload);
    return response.data;
  },

  getItems: async (params = {}) => {
    const response = await api.get('/house-inventory', { params });
    return response.data;
  },

  importFromWorkbook: async () => {
    const response = await api.post('/house-inventory/import-from-docs');
    return response.data;
  },

  createItem: async (payload) => {
    const response = await api.post('/house-inventory', payload);
    return response.data;
  },

  updateItem: async (id, payload) => {
    const response = await api.put(`/house-inventory/${id}`, payload);
    return response.data;
  },

  deleteItem: async (id) => {
    const response = await api.delete(`/house-inventory/${id}`);
    return response.data;
  }
};

export default houseInventoryService;
